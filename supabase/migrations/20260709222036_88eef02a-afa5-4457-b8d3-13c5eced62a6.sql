-- ============================================================
-- 1. Helper: is_super_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- ============================================================
-- 2. Transaction update scope: admins record-only, super admins edit
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_transaction_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- System / service-role context (no authenticated user): allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Super admins may change anything
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Regular admins may approve/manage status but NOT edit financial details
  IF public.has_role(auth.uid(), 'admin') THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type
       OR NEW.account_id IS DISTINCT FROM OLD.account_id
       OR NEW.loan_id IS DISTINCT FROM OLD.loan_id
       OR NEW.tnx_id IS DISTINCT FROM OLD.tnx_id
    THEN
      RAISE EXCEPTION 'Only super admins can edit transaction amount, date, or description';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Insufficient privileges to update transactions';
END;
$$;

DROP TRIGGER IF EXISTS enforce_transaction_update_scope ON public.transactions;
CREATE TRIGGER enforce_transaction_update_scope
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_update_scope();

-- Restrict transaction deletion to super admins
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.transactions;
CREATE POLICY "Super admins can delete transactions"
ON public.transactions FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- 3. Audit logging (log everything)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_id uuid;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN rec_id := OLD.id; ELSE rec_id := NEW.id; END IF;
  EXCEPTION WHEN OTHERS THEN rec_id := NULL;
  END;

  INSERT INTO public.audit_logs(actor_id, table_name, operation, record_id, old_data, new_data)
  VALUES (
    auth.uid(), TG_TABLE_NAME, TG_OP, rec_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_loans ON public.loans;
CREATE TRIGGER audit_loans
AFTER INSERT OR UPDATE OR DELETE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_accounts ON public.accounts;
CREATE TRIGGER audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- ============================================================
-- 4. Rate limiting (stateless functions via shared DB counters)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier, action)
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) accesses this table.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _action text,
  _max_count integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur public.rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO cur FROM public.rate_limits
  WHERE identifier = _identifier AND action = _action
  FOR UPDATE;

  IF cur.id IS NULL THEN
    INSERT INTO public.rate_limits(identifier, action, window_start, count)
    VALUES (_identifier, _action, now(), 1);
    RETURN true;
  END IF;

  IF cur.window_start < now() - make_interval(secs => _window_seconds) THEN
    UPDATE public.rate_limits
    SET window_start = now(), count = 1, updated_at = now()
    WHERE id = cur.id;
    RETURN true;
  END IF;

  IF cur.count >= _max_count THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limits
  SET count = count + 1, updated_at = now()
  WHERE id = cur.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

-- ============================================================
-- 5. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_loan_id ON public.transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_loans_account_id ON public.loans(account_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_guarantor_account_id ON public.loans(guarantor_account_id);
CREATE INDEX IF NOT EXISTS idx_loans_disbursed_at ON public.loans(disbursed_at);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON public.accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON public.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_account_profiles_account_id ON public.sub_account_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);