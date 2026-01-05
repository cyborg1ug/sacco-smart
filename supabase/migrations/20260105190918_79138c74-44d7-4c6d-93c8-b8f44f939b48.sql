-- Fix 1: Add authorization check to check_loan_eligibility RPC function
CREATE OR REPLACE FUNCTION public.check_loan_eligibility(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_savings DECIMAL(15, 2);
  v_max_loan DECIMAL(15, 2);
BEGIN
  -- Verify caller owns the account or is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id
    AND user_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: You can only check eligibility for your own account';
  END IF;
  
  -- Get total savings for max loan calculation (3x savings)
  SELECT COALESCE(total_savings, 0) INTO v_total_savings
  FROM public.accounts
  WHERE id = p_account_id;
  
  v_max_loan := v_total_savings * 3;
  
  -- Member is eligible if they have any savings
  RETURN jsonb_build_object(
    'is_eligible', v_total_savings > 0,
    'total_savings', v_total_savings,
    'max_loan_amount', v_max_loan
  );
END;
$function$;

-- Fix 2: Create RPC function for guarantor selection with limited data exposure
CREATE OR REPLACE FUNCTION public.get_guarantor_candidates()
RETURNS TABLE(
  account_id uuid,
  account_number text,
  full_name text,
  total_savings numeric,
  account_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return main accounts (not current user's)
  RETURN QUERY
  SELECT 
    a.id as account_id,
    a.account_number,
    p.full_name,
    a.total_savings,
    a.account_type
  FROM public.accounts a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id != auth.uid()
  AND a.account_type = 'main'
  
  UNION ALL
  
  -- Return sub-accounts (not current user's)
  SELECT 
    a.id as account_id,
    a.account_number,
    sap.full_name,
    a.total_savings,
    a.account_type
  FROM public.accounts a
  JOIN public.sub_account_profiles sap ON sap.account_id = a.id
  JOIN public.accounts parent ON parent.id = a.parent_account_id
  WHERE parent.user_id != auth.uid()
  AND a.account_type = 'sub';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_guarantor_candidates() TO authenticated;

-- Fix 3: Remove overly permissive RLS policies for guarantor selection
DROP POLICY IF EXISTS "Authenticated users can view accounts for guarantor selection" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can view profiles for guarantor selection" ON public.profiles;

-- Fix 4: Make receipts bucket private and update RLS policies
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- Drop the public read policy
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Users can view their own receipts (by matching transaction ID in filename)
CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow if user is admin
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    -- Or allow if receipt belongs to user's transaction
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      JOIN public.accounts a ON a.id = t.account_id
      WHERE a.user_id = auth.uid()
      AND name LIKE CONCAT('receipt-', t.tnx_id, '%')
    )
  )
);