-- Add DELETE policy for admins on transactions
CREATE POLICY "Admins can delete transactions" 
ON public.transactions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add loan_id column to transactions table to link loan repayments to specific loans
ALTER TABLE public.transactions 
ADD COLUMN loan_id uuid REFERENCES public.loans(id);

-- Create a function to update loan outstanding_balance when a loan repayment is approved
CREATE OR REPLACE FUNCTION public.update_loan_on_repayment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process loan repayments when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    IF NEW.transaction_type = 'loan_repayment' AND NEW.loan_id IS NOT NULL THEN
      -- Update the loan's outstanding_balance
      UPDATE loans 
      SET outstanding_balance = GREATEST(outstanding_balance - NEW.amount, 0),
          status = CASE 
            WHEN GREATEST(outstanding_balance - NEW.amount, 0) = 0 THEN 'fully_paid'
            ELSE status
          END,
          updated_at = now()
      WHERE id = NEW.loan_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update loan on repayment approval
DROP TRIGGER IF EXISTS on_loan_repayment_approved ON transactions;
CREATE TRIGGER on_loan_repayment_approved
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (NEW.transaction_type = 'loan_repayment' AND NEW.loan_id IS NOT NULL)
  EXECUTE FUNCTION public.update_loan_on_repayment();

-- Also handle direct inserts with approved status
DROP TRIGGER IF EXISTS on_loan_repayment_insert_approved ON transactions;
CREATE TRIGGER on_loan_repayment_insert_approved
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND NEW.transaction_type = 'loan_repayment' AND NEW.loan_id IS NOT NULL)
  EXECUTE FUNCTION public.update_loan_on_repayment();