-- Update check_loan_eligibility function to accept sub-accounts
-- The caller must own the main account that the sub-account belongs to
CREATE OR REPLACE FUNCTION public.check_loan_eligibility(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_savings DECIMAL(15, 2);
  v_max_loan DECIMAL(15, 2);
  v_account_record RECORD;
BEGIN
  -- Get the account details
  SELECT * INTO v_account_record
  FROM public.accounts
  WHERE id = p_account_id;
  
  IF v_account_record IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  
  -- Verify caller owns the account or parent account (for sub-accounts) or is an admin
  IF v_account_record.account_type = 'main' THEN
    -- For main accounts, user must own it directly
    IF v_account_record.user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Access denied: You can only check eligibility for your own account';
    END IF;
  ELSE
    -- For sub-accounts, check if user owns the parent account
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = v_account_record.parent_account_id
      AND user_id = auth.uid()
    ) AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Access denied: You can only check eligibility for your own sub-accounts';
    END IF;
  END IF;
  
  -- Get total savings for max loan calculation (3x savings)
  v_total_savings := COALESCE(v_account_record.total_savings, 0);
  v_max_loan := v_total_savings * 3;
  
  -- Member is eligible if they have any savings
  RETURN jsonb_build_object(
    'is_eligible', v_total_savings > 0,
    'total_savings', v_total_savings,
    'max_loan_amount', v_max_loan
  );
END;
$$;

-- Add RLS policy for users to insert loans from their sub-accounts
DROP POLICY IF EXISTS "Users can insert loan applications" ON public.loans;

CREATE POLICY "Users can insert loan applications"
ON public.loans
FOR INSERT
WITH CHECK (
  -- Can insert if account is their main account
  EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = loans.account_id
    AND accounts.user_id = auth.uid()
  )
  OR
  -- Can insert if account is their sub-account
  EXISTS (
    SELECT 1 FROM public.accounts sub
    JOIN public.accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = loans.account_id
    AND parent.user_id = auth.uid()
  )
);

-- Add policy for users to view loans from their sub-accounts
DROP POLICY IF EXISTS "Users can view their own loans" ON public.loans;

CREATE POLICY "Users can view their own loans"
ON public.loans
FOR SELECT
USING (
  -- Can view if account is their main account
  EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = loans.account_id
    AND accounts.user_id = auth.uid()
  )
  OR
  -- Can view if account is their sub-account
  EXISTS (
    SELECT 1 FROM public.accounts sub
    JOIN public.accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = loans.account_id
    AND parent.user_id = auth.uid()
  )
);

-- Update the guarantors policy to include sub-accounts
DROP POLICY IF EXISTS "Users can view loans where they are guarantor" ON public.loans;

CREATE POLICY "Users can view loans where they are guarantor"
ON public.loans
FOR SELECT
USING (
  -- Can view if their main account is the guarantor
  EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = loans.guarantor_account_id
    AND accounts.user_id = auth.uid()
  )
  OR
  -- Can view if their sub-account is the guarantor
  EXISTS (
    SELECT 1 FROM public.accounts sub
    JOIN public.accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = loans.guarantor_account_id
    AND parent.user_id = auth.uid()
  )
);

-- Update guarantor status update policy to include sub-accounts
DROP POLICY IF EXISTS "Guarantors can update their guarantor status" ON public.loans;

CREATE POLICY "Guarantors can update their guarantor status"
ON public.loans
FOR UPDATE
USING (
  -- Can update if their main account is the guarantor
  EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = loans.guarantor_account_id
    AND accounts.user_id = auth.uid()
  )
  OR
  -- Can update if their sub-account is the guarantor
  EXISTS (
    SELECT 1 FROM public.accounts sub
    JOIN public.accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = loans.guarantor_account_id
    AND parent.user_id = auth.uid()
  )
);