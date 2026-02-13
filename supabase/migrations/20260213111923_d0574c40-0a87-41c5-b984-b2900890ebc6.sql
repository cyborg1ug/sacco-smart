-- Drop the conflicting loan repayment triggers that cause double deduction
-- The application code in TransactionsManagement.tsx handles loan balance updates with interest logic
DROP TRIGGER IF EXISTS on_loan_repayment_approved ON public.transactions;
DROP TRIGGER IF EXISTS on_loan_repayment_insert_approved ON public.transactions;

-- Also drop the account savings triggers since the code handles account updates too
-- These cause double balance updates for deposits and withdrawals
DROP TRIGGER IF EXISTS on_transaction_approved ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_insert_approved ON public.transactions;