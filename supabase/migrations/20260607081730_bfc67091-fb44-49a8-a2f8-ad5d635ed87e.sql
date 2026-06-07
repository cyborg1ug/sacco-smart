-- 1. Lock down SECURITY DEFINER function execution
-- Pure trigger functions: never called via API, revoke from everyone (triggers still work)
REVOKE EXECUTE ON FUNCTION public.set_tnx_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_account_savings_on_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_loan_on_repayment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Phone login email lookup: needed by anon (user not yet authenticated)
REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;

-- Authenticated-only RPCs
REVOKE EXECUTE ON FUNCTION public.generate_tnx_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_tnx_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_loan_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_loan_eligibility(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_guarantor_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_guarantor_candidates() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_guarantor_candidates(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_guarantor_candidates(numeric) TO authenticated;

-- RLS helper functions: required by authenticated role for policy evaluation, revoke anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_owns_parent_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_parent_account(uuid) TO authenticated;

-- 2. Restrict guarantor loan updates to only the guarantor_status field
CREATE OR REPLACE FUNCTION public.enforce_guarantor_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admins can update anything
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Loan account owner (main account) can update anything
  IF EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = NEW.account_id AND user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Loan account owner via parent (sub-account) can update anything
  IF EXISTS (
    SELECT 1 FROM public.accounts sub
    JOIN public.accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = NEW.account_id AND parent.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Otherwise (guarantor): only guarantor_status may change
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.interest_rate IS DISTINCT FROM OLD.interest_rate
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.outstanding_balance IS DISTINCT FROM OLD.outstanding_balance
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.guarantor_account_id IS DISTINCT FROM OLD.guarantor_account_id
     OR NEW.repayment_months IS DISTINCT FROM OLD.repayment_months
     OR NEW.max_loan_amount IS DISTINCT FROM OLD.max_loan_amount
     OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at
  THEN
    RAISE EXCEPTION 'Guarantors may only update guarantor_status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_guarantor_update_scope_trigger ON public.loans;
CREATE TRIGGER enforce_guarantor_update_scope_trigger
BEFORE UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.enforce_guarantor_update_scope();

-- Add WITH CHECK to the guarantor update policy (defense in depth: cannot reassign guarantor)
DROP POLICY IF EXISTS "Guarantors can update their guarantor status" ON public.loans;
CREATE POLICY "Guarantors can update their guarantor status"
ON public.loans
FOR UPDATE
USING (
  (EXISTS ( SELECT 1 FROM accounts
    WHERE accounts.id = loans.guarantor_account_id AND accounts.user_id = auth.uid()))
  OR (EXISTS ( SELECT 1 FROM accounts sub
    JOIN accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = loans.guarantor_account_id AND parent.user_id = auth.uid()))
)
WITH CHECK (
  (EXISTS ( SELECT 1 FROM accounts
    WHERE accounts.id = loans.guarantor_account_id AND accounts.user_id = auth.uid()))
  OR (EXISTS ( SELECT 1 FROM accounts sub
    JOIN accounts parent ON parent.id = sub.parent_account_id
    WHERE sub.id = loans.guarantor_account_id AND parent.user_id = auth.uid()))
);

-- 3. Explicit admin-only policies for unscoped private buckets
CREATE POLICY "Admins can view transactionids"
ON storage.objects FOR SELECT
USING (bucket_id = 'transactionids' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload transactionids"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transactionids' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update transactionids"
ON storage.objects FOR UPDATE
USING (bucket_id = 'transactionids' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete transactionids"
ON storage.objects FOR DELETE
USING (bucket_id = 'transactionids' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view codefortheproject"
ON storage.objects FOR SELECT
USING (bucket_id = 'codefortheproject' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload codefortheproject"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'codefortheproject' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update codefortheproject"
ON storage.objects FOR UPDATE
USING (bucket_id = 'codefortheproject' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete codefortheproject"
ON storage.objects FOR DELETE
USING (bucket_id = 'codefortheproject' AND has_role(auth.uid(), 'admin'::app_role));