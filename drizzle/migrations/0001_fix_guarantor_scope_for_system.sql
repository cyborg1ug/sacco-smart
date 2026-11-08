CREATE OR REPLACE FUNCTION public.enforce_guarantor_update_scope()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR current_setting('app.reconciling', true) = 'on'
     OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND user_id = auth.uid()) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.accounts sub JOIN public.accounts parent ON parent.id = sub.parent_account_id
             WHERE sub.id = NEW.account_id AND parent.user_id = auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate
     OR NEW.status IS DISTINCT FROM OLD.status OR NEW.outstanding_balance IS DISTINCT FROM OLD.outstanding_balance
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.guarantor_account_id IS DISTINCT FROM OLD.guarantor_account_id OR NEW.repayment_months IS DISTINCT FROM OLD.repayment_months
     OR NEW.max_loan_amount IS DISTINCT FROM OLD.max_loan_amount OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at THEN
    RAISE EXCEPTION 'Guarantors may only update guarantor_status';
  END IF;
  RETURN NEW;
END;
$function$;