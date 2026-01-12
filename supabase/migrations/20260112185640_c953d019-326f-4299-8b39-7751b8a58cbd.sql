-- Add repayment_months column to loans table for repayment plan
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS repayment_months integer DEFAULT 1;

-- Add comment for the column
COMMENT ON COLUMN public.loans.repayment_months IS 'Number of months for loan repayment. Interest is fixed 2% per month of loan activity.';