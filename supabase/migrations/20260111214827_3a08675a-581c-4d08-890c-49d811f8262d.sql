-- Fix RLS policies for profiles table
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "deny_anon_access" ON public.profiles;

-- Create restrictive SELECT policy - users can only see their own profile, admins can see all
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- Fix RLS policies for sub_account_profiles table  
-- Drop existing policies that may be too permissive
DROP POLICY IF EXISTS "Users can view sub account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Users can view own sub account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Sub account profiles are viewable by parent owner" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "deny_anon_access" ON public.sub_account_profiles;

-- Create restrictive SELECT policy - only parent account owner or admin can view
CREATE POLICY "Users can view own sub account profiles"
ON public.sub_account_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = sub_account_profiles.account_id
    AND (
      a.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.accounts parent
        WHERE parent.id = a.parent_account_id
        AND parent.user_id = auth.uid()
      )
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Fix RLS policies for accounts table
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Accounts are viewable by everyone" ON public.accounts;
DROP POLICY IF EXISTS "deny_anon_access" ON public.accounts;

-- Create restrictive SELECT policy - users can only see their own accounts, admins can see all
CREATE POLICY "Users can view own accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.accounts parent
    WHERE parent.id = accounts.parent_account_id
    AND parent.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Ensure anonymous users cannot access these tables
CREATE POLICY "Deny anonymous profiles access"
ON public.profiles
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous sub_account_profiles access"
ON public.sub_account_profiles
FOR ALL
TO anon
USING (false);

CREATE POLICY "Deny anonymous accounts access"
ON public.accounts
FOR ALL
TO anon
USING (false);