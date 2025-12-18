-- Fix accounts table RLS policies - ensure PERMISSIVE policies with TO authenticated
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "deny_anon_access" ON public.accounts;
DROP POLICY IF EXISTS "Admins can update all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;

-- Recreate as PERMISSIVE policies with TO authenticated
-- Users can only view their own account
CREATE POLICY "Users can view their own account"
ON public.accounts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all accounts
CREATE POLICY "Admins can view all accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all accounts
CREATE POLICY "Admins can update all accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert accounts
CREATE POLICY "Admins can insert accounts"
ON public.accounts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Explicit deny for anonymous users (defense in depth)
CREATE POLICY "deny_anon_access"
ON public.accounts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);