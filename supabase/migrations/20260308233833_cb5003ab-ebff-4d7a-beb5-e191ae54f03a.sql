-- Add 'overdue_interest' to the allowed transaction types
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_transaction_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'deposit',
    'withdrawal',
    'loan_disbursement',
    'loan_repayment',
    'interest_received',
    'overdue_interest'
  ]));