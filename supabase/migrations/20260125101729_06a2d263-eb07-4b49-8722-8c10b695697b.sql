-- Add receipt_number column to transactions for manual receipt references
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS receipt_number text;

-- Update get_guarantor_candidates to allow sub-accounts to guarantee main accounts within same parent
-- A member can guarantee multiple loans as long as they have sufficient savings
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
  -- Return all main accounts (including current user's for cross-account guarantees)
  RETURN QUERY
  SELECT 
    a.id as account_id,
    a.account_number,
    p.full_name,
    a.total_savings,
    a.account_type
  FROM public.accounts a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.account_type = 'main'
  
  UNION ALL
  
  -- Return all sub-accounts (including current user's for cross-account guarantees)
  SELECT 
    a.id as account_id,
    a.account_number,
    sap.full_name,
    a.total_savings,
    a.account_type
  FROM public.accounts a
  JOIN public.sub_account_profiles sap ON sap.account_id = a.id
  WHERE a.account_type = 'sub';
END;
$$;