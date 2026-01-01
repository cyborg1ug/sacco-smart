-- Drop the restrictive select policy and create a more permissive one for guarantor selection
DROP POLICY IF EXISTS "restrict_account_access" ON public.accounts;

-- Create policy that allows users to see their own accounts fully
CREATE POLICY "Users can view their own accounts" 
ON public.accounts 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy that allows authenticated users to view basic account info for guarantor selection
CREATE POLICY "Authenticated users can view accounts for guarantor selection" 
ON public.accounts 
FOR SELECT 
TO authenticated
USING (true);

-- Admins can still view all accounts
CREATE POLICY "Admins can view all accounts" 
ON public.accounts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));