-- Create a function to update account total_savings when a deposit transaction is approved
CREATE OR REPLACE FUNCTION public.update_account_savings_on_transaction()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Handle deposits - add to total_savings
    IF NEW.transaction_type = 'deposit' THEN
      UPDATE accounts 
      SET total_savings = total_savings + NEW.amount,
          balance = balance + NEW.amount,
          updated_at = now()
      WHERE id = NEW.account_id;
    -- Handle withdrawals - subtract from balance (not total_savings)
    ELSIF NEW.transaction_type = 'withdrawal' THEN
      UPDATE accounts 
      SET balance = balance - NEW.amount,
          updated_at = now()
      WHERE id = NEW.account_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire on transaction updates
DROP TRIGGER IF EXISTS on_transaction_approved ON transactions;
CREATE TRIGGER on_transaction_approved
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_savings_on_transaction();

-- Also create a trigger for inserts when transaction is created as approved directly
DROP TRIGGER IF EXISTS on_transaction_insert_approved ON transactions;
CREATE TRIGGER on_transaction_insert_approved
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.update_account_savings_on_transaction();