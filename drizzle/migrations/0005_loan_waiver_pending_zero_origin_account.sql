ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS penalty_waived boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS origin_account_id uuid REFERENCES public.accounts(id);
CREATE INDEX IF NOT EXISTS idx_transactions_origin_account ON public.transactions(origin_account_id);

UPDATE public.transactions t SET origin_account_id = x.orig
FROM (
  SELECT DISTINCT ON (record_id) record_id, (old_data->>'account_id')::uuid AS orig
  FROM public.audit_logs
  WHERE table_name='transactions' AND operation='UPDATE'
    AND old_data->>'account_id' IS DISTINCT FROM new_data->>'account_id'
  ORDER BY record_id, created_at ASC
) x
WHERE t.id = x.record_id AND t.origin_account_id IS NULL;

UPDATE public.transactions SET origin_account_id = account_id WHERE origin_account_id IS NULL;
ALTER TABLE public.transactions ALTER COLUMN origin_account_id SET DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.set_origin_account()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.origin_account_id IS NULL THEN NEW.origin_account_id := NEW.account_id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS set_transaction_origin_account ON public.transactions;
CREATE TRIGGER set_transaction_origin_account BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_origin_account();

CREATE OR REPLACE FUNCTION public.reconcile_loan_ledger(p_loan_id uuid, p_rebuild_penalties boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l loans%ROWTYPE; v_total numeric; v_repaid numeric; v_penalties numeric; v_outstanding numeric; v_due date; v_day date; v_daily numeric; v_running numeric; v_interest numeric; v_portion numeric; v_tx uuid; r record; v_old_setting text; v_end date;
BEGIN
 SELECT * INTO l FROM loans WHERE id=p_loan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
 v_old_setting:=current_setting('app.reconciling',true); PERFORM set_config('app.reconciling','on',true);
 v_total:=round(l.amount*(1+l.interest_rate/100*coalesce(l.repayment_months,1)),2);
 v_end:=least((now() AT TIME ZONE 'UTC')::date, public.financial_cutoff_date());
 IF (p_rebuild_penalties OR l.penalty_waived) AND (l.disbursed_at IS NULL OR l.status IN ('pending','rejected') OR l.penalty_waived) THEN
  UPDATE transactions SET status='rejected' WHERE loan_id=l.id AND transaction_type='overdue_interest' AND status='approved';
 END IF;
 IF p_rebuild_penalties AND l.disbursed_at IS NOT NULL AND l.status NOT IN ('pending','rejected') AND NOT l.penalty_waived THEN
  v_due:=(l.disbursed_at+make_interval(months=>coalesce(l.repayment_months,1)))::date;
  v_daily:=round(l.amount*0.02/30,2); v_running:=v_total;
  UPDATE transactions SET status='rejected' WHERE loan_id=l.id AND transaction_type='overdue_interest' AND status='approved';
  FOR v_day IN SELECT generate_series(v_due+1,v_end,interval '1 day')::date LOOP
   SELECT coalesce(sum(amount),0) INTO v_repaid FROM transactions WHERE loan_id=l.id AND transaction_type='loan_repayment' AND status='approved' AND (created_at AT TIME ZONE 'UTC')::date<v_day;
   IF v_running-v_repaid<=0 THEN EXIT; END IF;
   SELECT id INTO v_tx FROM transactions WHERE loan_id=l.id AND transaction_type='overdue_interest' AND (created_at AT TIME ZONE 'UTC')::date=v_day ORDER BY created_at,id LIMIT 1;
   IF v_tx IS NULL THEN
    INSERT INTO transactions(account_id,loan_id,transaction_type,amount,balance_after,status,created_at,approved_at,description) VALUES(l.account_id,l.id,'overdue_interest',v_daily,0,'approved',v_day::timestamp AT TIME ZONE 'UTC',now(),'Daily overdue penalty (2%/30) ['||v_day||']');
   ELSE
    UPDATE transactions SET amount=v_daily,status='approved',account_id=l.account_id,description='Daily overdue penalty (2%/30) ['||v_day||']' WHERE id=v_tx;
   END IF;
   v_running:=v_running+v_daily; v_tx:=NULL;
  END LOOP;
 END IF;
 SELECT coalesce(sum(amount) FILTER (WHERE transaction_type='loan_repayment'),0),coalesce(sum(amount) FILTER (WHERE transaction_type='overdue_interest'),0) INTO v_repaid,v_penalties FROM transactions WHERE loan_id=l.id AND status='approved';
 v_outstanding:=CASE WHEN l.status IN ('rejected','pending') OR l.disbursed_at IS NULL THEN 0 ELSE greatest(0,v_total+v_penalties-v_repaid) END;
 UPDATE loans SET total_amount=v_total,outstanding_balance=v_outstanding,status=CASE WHEN status IN ('pending','rejected') THEN status WHEN disbursed_at IS NULL THEN status WHEN v_outstanding=0 THEN 'fully_paid' ELSE 'disbursed' END,updated_at=now()
  WHERE id=l.id AND (total_amount IS DISTINCT FROM v_total OR outstanding_balance IS DISTINCT FROM v_outstanding OR (status IN ('completed','fully_paid') AND v_outstanding>0) OR (status NOT IN ('pending','rejected','completed','fully_paid') AND disbursed_at IS NOT NULL AND v_outstanding=0));
 UPDATE transactions SET status='rejected' WHERE loan_id=l.id AND transaction_type='interest_received' AND status='approved';
 v_interest:=greatest(0,v_total-l.amount);
 FOR r IN SELECT id,amount,created_at,transaction_type FROM transactions WHERE loan_id=l.id AND transaction_type IN ('loan_repayment','overdue_interest') AND status='approved' ORDER BY created_at,id LOOP
  IF r.transaction_type='overdue_interest' THEN v_interest:=v_interest+r.amount; CONTINUE; END IF;
  v_portion:=least(r.amount,v_interest); v_interest:=greatest(0,v_interest-v_portion);
  IF v_portion>0 THEN
   SELECT id INTO v_tx FROM transactions WHERE source_transaction_id=r.id AND transaction_type='interest_received' ORDER BY id LIMIT 1;
   IF v_tx IS NULL THEN INSERT INTO transactions(account_id,loan_id,source_transaction_id,transaction_type,amount,balance_after,status,created_at,approved_at,description) VALUES(l.account_id,l.id,r.id,'interest_received',v_portion,0,'approved',r.created_at,now(),'Interest-first allocation for repayment '||r.id);
   ELSE UPDATE transactions SET amount=v_portion,created_at=r.created_at,account_id=l.account_id,status='approved' WHERE id=v_tx; END IF;
   v_tx:=NULL;
  END IF;
 END LOOP;
 PERFORM reconcile_account_ledger(l.account_id);
 PERFORM set_config('app.reconciling',coalesce(v_old_setting,''),true);
END $function$;

CREATE OR REPLACE FUNCTION public.sync_financial_loan()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_setting text;
BEGIN
 IF current_setting('app.reconciling',true)='on' THEN RETURN NULL; END IF;
 IF NEW.amount IS NOT DISTINCT FROM OLD.amount AND NEW.interest_rate IS NOT DISTINCT FROM OLD.interest_rate AND NEW.repayment_months IS NOT DISTINCT FROM OLD.repayment_months AND NEW.disbursed_at IS NOT DISTINCT FROM OLD.disbursed_at AND NEW.penalty_waived IS NOT DISTINCT FROM OLD.penalty_waived AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
 v_setting:=current_setting('app.reconciling',true); PERFORM set_config('app.reconciling','on',true);
 IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.disbursed_at IS DISTINCT FROM OLD.disbursed_at THEN
  UPDATE transactions SET amount=NEW.amount,created_at=coalesce(NEW.disbursed_at,created_at) WHERE loan_id=NEW.id AND transaction_type='loan_disbursement' AND status<>'rejected';
 END IF;
 PERFORM reconcile_loan_ledger(NEW.id,true); PERFORM set_config('app.reconciling',coalesce(v_setting,''),true); RETURN NULL;
END $function$;

REVOKE EXECUTE ON FUNCTION public.set_origin_account() FROM PUBLIC, anon, authenticated;