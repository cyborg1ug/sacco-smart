-- Add main/sub account structure for account merging
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'main' CHECK (account_type IN ('main', 'sub'));

-- Create welfare table for tracking welfare fees
CREATE TABLE IF NOT EXISTS public.welfare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  week_date date NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on welfare
ALTER TABLE public.welfare ENABLE ROW LEVEL SECURITY;

-- RLS policies for welfare (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'welfare' AND policyname = 'Admins can view all welfare'
  ) THEN
    CREATE POLICY "Admins can view all welfare" ON public.welfare
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'welfare' AND policyname = 'Admins can insert welfare'
  ) THEN
    CREATE POLICY "Admins can insert welfare" ON public.welfare
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'welfare' AND policyname = 'Users can view their own welfare'
  ) THEN
    CREATE POLICY "Users can view their own welfare" ON public.welfare
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = welfare.account_id
        AND accounts.user_id = auth.uid()
      )
    );
  END IF;
END $$;