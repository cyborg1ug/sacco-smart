-- Add explicit deny policy for anonymous access to accounts table
-- This provides defense-in-depth even though authenticated-only policies exist

CREATE POLICY "deny_anon_access"
ON public.accounts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);