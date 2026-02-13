-- Add 'interest_received' to the allowed transaction_type values
ALTER TABLE public.transactions DROP CONSTRAINT transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check 
  CHECK (transaction_type = ANY (ARRAY['deposit'::text, 'withdrawal'::text, 'loan_disbursement'::text, 'loan_repayment'::text, 'interest_received'::text]));