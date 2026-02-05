
-- Update get_guarantor_candidates function to exclude accounts already guaranteeing active loans
CREATE OR REPLACE FUNCTION public.get_guarantor_candidates()
 RETURNS TABLE(account_id uuid, account_number text, full_name text, total_savings numeric, account_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return all main accounts that are NOT currently guaranteeing an active loan
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
    AND NOT EXISTS (
      SELECT 1 FROM public.loans l 
      WHERE l.guarantor_account_id = a.id 
        AND l.status IN ('pending', 'approved', 'disbursed', 'active')
        AND l.outstanding_balance > 0
    )
  
  UNION ALL
  
  -- Return all sub-accounts that are NOT currently guaranteeing an active loan
  SELECT 
    a.id as account_id,
    a.account_number,
    sap.full_name,
    a.total_savings,
    a.account_type
  FROM public.accounts a
  JOIN public.sub_account_profiles sap ON sap.account_id = a.id
  WHERE a.account_type = 'sub'
    AND NOT EXISTS (
      SELECT 1 FROM public.loans l 
      WHERE l.guarantor_account_id = a.id 
        AND l.status IN ('pending', 'approved', 'disbursed', 'active')
        AND l.outstanding_balance > 0
    );
END;
$function$;
