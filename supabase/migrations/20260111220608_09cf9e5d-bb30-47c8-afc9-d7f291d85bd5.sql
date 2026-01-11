-- Drop all existing SELECT policies on accounts to fix recursion
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;

-- Create simple non-recursive SELECT policy for users (direct user_id check only)
CREATE POLICY "Users can view their own accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create simple non-recursive SELECT policy for sub-accounts (using security definer function)
CREATE OR REPLACE FUNCTION public.user_owns_parent_account(account_parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = account_parent_id AND user_id = auth.uid()
  )
$$;

-- Policy for viewing sub-accounts (owned by parent)
CREATE POLICY "Users can view their sub-accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  parent_account_id IS NOT NULL 
  AND public.user_owns_parent_account(parent_account_id)
);

-- Admin policy using existing has_role function
CREATE POLICY "Admins can view all accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));