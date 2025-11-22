-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix search_path for check_loan_eligibility function  
CREATE OR REPLACE FUNCTION public.check_loan_eligibility(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_min_amount DECIMAL(15, 2) := 10000;
BEGIN
  -- Check if account has 4 consecutive weeks of savings >= 10000 UGX
  SELECT COUNT(*) INTO v_count
  FROM public.savings
  WHERE account_id = p_account_id
    AND amount >= v_min_amount
    AND week_start >= (CURRENT_DATE - INTERVAL '4 weeks')
  GROUP BY account_id;
  
  RETURN COALESCE(v_count >= 4, FALSE);
END;
$$;