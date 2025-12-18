-- Create sub_account_profiles table for sub-account profile info
CREATE TABLE public.sub_account_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  national_id TEXT,
  occupation TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

-- Enable RLS
ALTER TABLE public.sub_account_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own sub-account profiles (via parent account)
CREATE POLICY "Users can view their sub-account profiles"
ON public.sub_account_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts sa
    JOIN public.accounts pa ON sa.parent_account_id = pa.id
    WHERE sa.id = sub_account_profiles.account_id
    AND pa.user_id = auth.uid()
  )
);

-- Users can update their sub-account profiles
CREATE POLICY "Users can update their sub-account profiles"
ON public.sub_account_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts sa
    JOIN public.accounts pa ON sa.parent_account_id = pa.id
    WHERE sa.id = sub_account_profiles.account_id
    AND pa.user_id = auth.uid()
  )
);

-- Admins can view all sub-account profiles
CREATE POLICY "Admins can view all sub-account profiles"
ON public.sub_account_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert sub-account profiles
CREATE POLICY "Admins can insert sub-account profiles"
ON public.sub_account_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all sub-account profiles
CREATE POLICY "Admins can update all sub-account profiles"
ON public.sub_account_profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete sub-account profiles
CREATE POLICY "Admins can delete sub-account profiles"
ON public.sub_account_profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_sub_account_profiles_updated_at
BEFORE UPDATE ON public.sub_account_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();