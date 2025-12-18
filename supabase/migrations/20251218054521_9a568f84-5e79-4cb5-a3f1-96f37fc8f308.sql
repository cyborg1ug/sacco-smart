-- Update loan eligibility function to remove consecutive weeks requirement
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