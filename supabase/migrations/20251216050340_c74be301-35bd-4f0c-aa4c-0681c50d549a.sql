-- Update RLS policy on accounts to allow admin to insert
CREATE POLICY "Admins can insert accounts" ON public.accounts
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow users to insert their own transactions (with pending status)
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert their own transactions" ON public.transactions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM accounts
    WHERE accounts.id = transactions.account_id
    AND accounts.user_id = auth.uid()
  )
);