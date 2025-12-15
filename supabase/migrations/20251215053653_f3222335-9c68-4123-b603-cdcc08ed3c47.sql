-- Drop old function and create new one with jsonb return type
DROP FUNCTION IF EXISTS public.check_loan_eligibility(uuid);

CREATE OR REPLACE FUNCTION public.check_loan_eligibility(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_min_amount DECIMAL(15, 2) := 10000;
  v_total_savings DECIMAL(15, 2);
  v_max_loan DECIMAL(15, 2);
  v_has_consecutive_weeks BOOLEAN;
BEGIN
  -- Check if account has 4 consecutive weeks of savings >= 10000 UGX
  SELECT COUNT(*) INTO v_count
  FROM public.savings
  WHERE account_id = p_account_id
    AND amount >= v_min_amount
    AND week_start >= (CURRENT_DATE - INTERVAL '4 weeks');
  
  v_has_consecutive_weeks := COALESCE(v_count >= 4, FALSE);
  
  -- Get total savings for max loan calculation (3x savings)
  SELECT COALESCE(total_savings, 0) INTO v_total_savings
  FROM public.accounts
  WHERE id = p_account_id;
  
  v_max_loan := v_total_savings * 3;
  
  RETURN jsonb_build_object(
    'is_eligible', v_has_consecutive_weeks,
    'total_savings', v_total_savings,
    'max_loan_amount', v_max_loan,
    'has_consecutive_weeks', v_has_consecutive_weeks
  );
END;
$function$;