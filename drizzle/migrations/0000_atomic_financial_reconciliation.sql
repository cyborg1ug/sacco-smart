ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS transactions_source_idx ON public.transactions(source_transaction_id);

CREATE OR REPLACE FUNCTION public.reconcile_account_ledger(p_account_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_balance numeric; v_deposits numeric; v_welfare numeric;
BEGIN
 PERFORM 1 FROM accounts WHERE id=p_account_id FOR UPDATE;
 SELECT coalesce(sum(CASE WHEN status='approved' AND transaction_type IN ('deposit','loan_disbursement') THEN amount WHEN status='approved' AND transaction_type IN ('withdrawal','loan_repayment') THEN -amount ELSE 0 END),0),coalesce(sum(amount) FILTER (WHERE status='approved' AND transaction_type='deposit'),0) INTO v_balance,v_deposits FROM transactions WHERE account_id=p_account_id;
 SELECT coalesce(sum(amount),0) INTO v_welfare FROM welfare WHERE account_id=p_account_id;
 UPDATE accounts SET balance=v_balance,total_savings=greatest(0,v_deposits-v_welfare),updated_at=now() WHERE id=p_account_id AND (balance IS DISTINCT FROM v_balance OR total_savings IS DISTINCT FROM greatest(0,v_deposits-v_welfare));
 WITH running AS (SELECT id,sum(CASE WHEN status='approved' AND transaction_type IN ('deposit','loan_disbursement') THEN amount WHEN status='approved' AND transaction_type IN ('withdrawal','loan_repayment') THEN -amount ELSE 0 END) OVER (ORDER BY created_at,id ROWS UNBOUNDED PRECEDING) AS balance FROM transactions WHERE account_id=p_account_id)
 UPDATE transactions t SET balance_after=r.balance FROM running r WHERE t.id=r.id AND t.balance_after IS DISTINCT FROM r.balance;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_loan_ledger(p_loan_id uuid,p_rebuild_penalties boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l loans%ROWTYPE; v_total numeric; v_repaid numeric; v_penalties numeric; v_outstanding numeric; v_due date; v_day date; v_daily numeric; v_running numeric; v_interest numeric; v_portion numeric; v_tx uuid; r record; v_old_setting text;
BEGIN
 SELECT * INTO l FROM loans WHERE id=p_loan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
 v_old_setting:=current_setting('app.reconciling',true); PERFORM set_config('app.reconciling','on',true);
 v_total:=round(l.amount*(1+l.interest_rate/100*coalesce(l.repayment_months,1)),2);
 IF p_rebuild_penalties AND l.disbursed_at IS NOT NULL AND l.status NOT IN ('pending','rejected') THEN
  v_due:=(l.disbursed_at+make_interval(months=>coalesce(l.repayment_months,1)))::date;
  v_daily:=round(l.amount*0.02/30,2); v_running:=v_total;
  UPDATE transactions SET status='rejected' WHERE loan_id=l.id AND transaction_type='overdue_interest' AND status='approved';
  FOR v_day IN SELECT generate_series(v_due+1,(now() AT TIME ZONE 'UTC')::date,interval '1 day')::date LOOP
   SELECT coalesce(sum(amount),0) INTO v_repaid FROM transactions WHERE loan_id=l.id AND transaction_type='loan_repayment' AND status='approved' AND (created_at AT TIME ZONE 'UTC')::date<v_day;
   IF v_running-v_repaid<=0 THEN EXIT; END IF;
   SELECT id INTO v_tx FROM transactions WHERE loan_id=l.id AND transaction_type='overdue_interest' AND (created_at AT TIME ZONE 'UTC')::date=v_day ORDER BY created_at,id LIMIT 1;
   IF v_tx IS NULL THEN
    INSERT INTO transactions(account_id,loan_id,transaction_type,amount,balance_after,status,created_at,approved_at,description) VALUES(l.account_id,l.id,'overdue_interest',v_daily,0,'approved',v_day::timestamp AT TIME ZONE 'UTC',now(),'Daily overdue penalty (2%/30) ['||v_day||']');
   ELSE
    UPDATE transactions SET amount=v_daily,status='approved',description='Daily overdue penalty (2%/30) ['||v_day||']' WHERE id=v_tx;
   END IF;
   v_running:=v_running+v_daily; v_tx:=NULL;
  END LOOP;
 END IF;
 SELECT coalesce(sum(amount) FILTER (WHERE transaction_type='loan_repayment'),0),coalesce(sum(amount) FILTER (WHERE transaction_type='overdue_interest'),0) INTO v_repaid,v_penalties FROM transactions WHERE loan_id=l.id AND status='approved';
 v_outstanding:=CASE WHEN l.status='rejected' THEN 0 ELSE greatest(0,v_total+v_penalties-v_repaid) END;
 UPDATE loans SET total_amount=v_total,outstanding_balance=v_outstanding,status=CASE WHEN status IN ('pending','rejected') THEN status WHEN v_outstanding=0 THEN 'fully_paid' WHEN disbursed_at IS NOT NULL THEN 'disbursed' ELSE status END,updated_at=now() WHERE id=l.id AND (total_amount IS DISTINCT FROM v_total OR outstanding_balance IS DISTINCT FROM v_outstanding OR (status IN ('completed','fully_paid') AND v_outstanding>0));
 -- Rebuild informational interest allocations without double-deducting repayments.
 UPDATE transactions SET status='rejected' WHERE loan_id=l.id AND transaction_type='interest_received' AND status='approved';
 v_interest:=greatest(0,v_total-l.amount);
 FOR r IN SELECT id,amount,created_at FROM transactions WHERE loan_id=l.id AND transaction_type IN ('loan_repayment','overdue_interest') AND status='approved' ORDER BY created_at,id LOOP
  IF EXISTS(SELECT 1 FROM transactions WHERE id=r.id AND transaction_type='overdue_interest') THEN v_interest:=v_interest+r.amount; CONTINUE; END IF;
  v_portion:=least(r.amount,v_interest); v_interest:=greatest(0,v_interest-v_portion);
  IF v_portion>0 THEN
   SELECT id INTO v_tx FROM transactions WHERE source_transaction_id=r.id AND transaction_type='interest_received' ORDER BY id LIMIT 1;
   IF v_tx IS NULL THEN INSERT INTO transactions(account_id,loan_id,source_transaction_id,transaction_type,amount,balance_after,status,created_at,approved_at,description) VALUES(l.account_id,l.id,r.id,'interest_received',v_portion,0,'approved',r.created_at,now(),'Interest-first allocation for repayment '||r.id);
   ELSE UPDATE transactions SET amount=v_portion,created_at=r.created_at,status='approved' WHERE id=v_tx; END IF;
   v_tx:=NULL;
  END IF;
 END LOOP;
 PERFORM reconcile_account_ledger(l.account_id);
 PERFORM set_config('app.reconciling',coalesce(v_old_setting,''),true);
END $$;

CREATE OR REPLACE FUNCTION public.sync_financial_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_setting text; v_id uuid;
BEGIN
 IF current_setting('app.reconciling',true)='on' THEN RETURN NULL; END IF;
 v_setting:=current_setting('app.reconciling',true); PERFORM set_config('app.reconciling','on',true);
 IF TG_OP<>'DELETE' AND NEW.loan_id IS NOT NULL THEN
  IF NEW.transaction_type='loan_disbursement' AND NEW.status='approved' THEN
   UPDATE loans SET amount=NEW.amount,disbursed_at=NEW.created_at,status='disbursed' WHERE id=NEW.loan_id AND (amount IS DISTINCT FROM NEW.amount OR disbursed_at IS DISTINCT FROM NEW.created_at OR status NOT IN ('disbursed','active','fully_paid','completed'));
  END IF;
  PERFORM reconcile_loan_ledger(NEW.loan_id,NEW.transaction_type IN ('loan_disbursement','loan_repayment'));
 END IF;
 IF TG_OP<>'INSERT' AND OLD.loan_id IS NOT NULL AND (TG_OP='DELETE' OR OLD.loan_id IS DISTINCT FROM NEW.loan_id) THEN PERFORM reconcile_loan_ledger(OLD.loan_id,true); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM reconcile_account_ledger(NEW.account_id); END IF;
 IF TG_OP<>'INSERT' AND (TG_OP='DELETE' OR OLD.account_id IS DISTINCT FROM NEW.account_id) THEN PERFORM reconcile_account_ledger(OLD.account_id); END IF;
 PERFORM set_config('app.reconciling',coalesce(v_setting,''),true); RETURN NULL;
END $$;
CREATE TRIGGER sync_financial_transaction AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.sync_financial_transaction();

CREATE OR REPLACE FUNCTION public.sync_financial_loan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_setting text;
BEGIN
 IF current_setting('app.reconciling',true)='on' THEN RETURN NULL; END IF;
 v_setting:=current_setting('app.reconciling',true); PERFORM set_config('app.reconciling','on',true);
 IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at THEN
  UPDATE transactions SET amount=NEW.amount,created_at=coalesce(NEW.disbursed_at,created_at) WHERE loan_id=NEW.id AND transaction_type='loan_disbursement' AND status<>'rejected';
 END IF;
 PERFORM reconcile_loan_ledger(NEW.id,true); PERFORM set_config('app.reconciling',coalesce(v_setting,''),true); RETURN NULL;
END $$;
CREATE TRIGGER sync_financial_loan AFTER UPDATE OF amount,interest_rate,repayment_months,disbursed_at ON public.loans FOR EACH ROW EXECUTE FUNCTION public.sync_financial_loan();

CREATE OR REPLACE FUNCTION public.enforce_transaction_update_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR (pg_trigger_depth()>1 AND current_setting('app.reconciling',true)='on') OR public.has_role(auth.uid(),'super_admin') THEN RETURN NEW; END IF;
 IF public.has_role(auth.uid(),'admin') THEN
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.description IS DISTINCT FROM OLD.description OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.loan_id IS DISTINCT FROM OLD.loan_id OR NEW.tnx_id IS DISTINCT FROM OLD.tnx_id THEN RAISE EXCEPTION 'Only super admins can edit transaction amount, date, or description'; END IF; RETURN NEW;
 END IF; RAISE EXCEPTION 'Insufficient privileges to update transactions';
END $$;

CREATE OR REPLACE FUNCTION public.apply_overdue_reconciliation() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l record; v_count integer:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 FOR l IN SELECT id FROM loans WHERE disbursed_at IS NOT NULL AND status IN ('approved','disbursed','active','completed','fully_paid') ORDER BY id LOOP PERFORM reconcile_loan_ledger(l.id,true); v_count:=v_count+1; END LOOP;
 RETURN jsonb_build_object('success',true,'updated',v_count,'skipped',0,'message','Reconciled overdue charges and balances for '||v_count||' loans');
END $$;
REVOKE ALL ON FUNCTION public.reconcile_account_ledger(uuid), public.reconcile_loan_ledger(uuid,boolean),public.sync_financial_transaction(),public.sync_financial_loan() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_account_ledger(uuid),public.reconcile_loan_ledger(uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.apply_overdue_reconciliation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_overdue_reconciliation() TO authenticated,service_role;
CREATE POLICY "Super admins manage financial accounts" ON public.accounts FOR ALL TO authenticated USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admins manage loans" ON public.loans FOR ALL TO authenticated USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admins manage transactions" ON public.transactions FOR ALL TO authenticated USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.accounts,public.loans,public.transactions TO authenticated;
GRANT ALL ON public.accounts,public.loans,public.transactions TO service_role;