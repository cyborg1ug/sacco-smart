-- Add guarantor columns to loans table if they don't exist
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS guarantor_account_id uuid REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS guarantor_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS max_loan_amount numeric;

-- Create index for faster guarantor queries
CREATE INDEX IF NOT EXISTS idx_loans_guarantor_account_id ON public.loans(guarantor_account_id);

-- Allow members to update guarantor_status on loans where they are the guarantor
CREATE POLICY "Guarantors can update their guarantor status" 
ON public.loans 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM accounts 
    WHERE accounts.id = loans.guarantor_account_id 
    AND accounts.user_id = auth.uid()
  )
);

-- Allow viewing loans where user is a guarantor
CREATE POLICY "Users can view loans where they are guarantor" 
ON public.loans 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM accounts 
    WHERE accounts.id = loans.guarantor_account_id 
    AND accounts.user_id = auth.uid()
  )
);