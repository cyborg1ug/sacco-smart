-- Add policy to allow authenticated users to view other profiles for guarantor selection
CREATE POLICY "Authenticated users can view profiles for guarantor selection"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);