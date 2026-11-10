CREATE OR REPLACE FUNCTION public.financial_cutoff_date()
 RETURNS date LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT DATE '2026-09-30' $$;

CREATE OR REPLACE FUNCTION public.reconcile_loan_ledger(p_loan_id uuid, p_rebuild_penalties boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l loans%ROWTYPE; v_total numeric; v_repaid numeric; v_penalties numeric; v_outstanding numeric; v_due date; v_day date; v_daily numeric; v_running numeric; v_interest numeric; v_portion numeric; v_tx uuid; r record; v_old_setting text; v_end date;
BEGIN
 SELECT * INTO l FROM loans WHERE id=p_loan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
 v_old_setting:=current_setting('app.reconciling',true); PERFORM set_config('app.reconciling','on',true);
 v_total:=round(l.amount*(1+l.interest_rate/100*coalesce(l.repayment_months,1)),2);
 v_end:=least((now() AT TIME ZONE 'UTC')::date, public.financial_cutoff_date());
 IF p_rebuild_penalties AND l.disbursed_at IS NOT NULL AND l.status NOT IN ('pending','rejected') THEN
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
 v_outstanding:=CASE WHEN l.status='rejected' THEN 0 ELSE greatest(0,v_total+v_penalties-v_repaid) END;
 UPDATE loans SET total_amount=v_total,outstanding_balance=v_outstanding,status=CASE WHEN status IN ('pending','rejected') THEN status WHEN v_outstanding=0 THEN 'fully_paid' WHEN disbursed_at IS NOT NULL THEN 'disbursed' ELSE status END,updated_at=now() WHERE id=l.id AND (total_amount IS DISTINCT FROM v_total OR outstanding_balance IS DISTINCT FROM v_outstanding OR (status IN ('completed','fully_paid') AND v_outstanding>0));
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