
CREATE OR REPLACE FUNCTION public.get_guarantor_candidates(p_min_savings numeric DEFAULT 0)
 RETURNS TABLE(account_id uuid, account_number text, full_name text, total_savings numeric, account_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
    AND a.total_savings >= p_min_savings
    AND NOT EXISTS (
      SELECT 1 FROM public.loans l 
      WHERE l.guarantor_account_id = a.id 
        AND l.status IN ('pending', 'approved', 'disbursed', 'active')
        AND l.outstanding_balance > 0
    )
  
  UNION ALL
  
  SELECT 
    a.id as account_id,
    a.account_number,
    sap.full_name,
    a.total_savings,
    a.account_type
  FROM public.accounts a
  JOIN public.sub_account_profiles sap ON sap.account_id = a.id
  WHERE a.account_type = 'sub'
    AND a.total_savings >= p_min_savings
    AND NOT EXISTS (
      SELECT 1 FROM public.loans l 
      WHERE l.guarantor_account_id = a.id 
        AND l.status IN ('pending', 'approved', 'disbursed', 'active')
        AND l.outstanding_balance > 0
    );
END;
$function$
