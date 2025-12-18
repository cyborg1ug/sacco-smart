-- Fix accounts table RLS - use combined policies with OR logic as recommended
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "deny_anon_access" ON public.accounts;
DROP POLICY IF EXISTS "Admins can update all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;

-- Create combined SELECT policy with OR logic (user's own account OR admin)
CREATE POLICY "restrict_account_access"
ON public.accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only UPDATE policy
CREATE POLICY "admin_update_accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only INSERT policy
CREATE POLICY "admin_insert_accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Explicit deny for anonymous users
CREATE POLICY "deny_anon_access"
ON public.accounts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);