CREATE OR REPLACE FUNCTION public.reconcile_account_ledger(p_account_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_balance numeric; v_deposits numeric; v_welfare numeric; v_deduct numeric; v_sav numeric;
BEGIN
 PERFORM 1 FROM accounts WHERE id=p_account_id FOR UPDATE;
 SELECT coalesce(sum(CASE WHEN status='approved' AND transaction_type IN ('deposit','loan_disbursement') THEN amount WHEN status='approved' AND transaction_type IN ('withdrawal','loan_repayment') THEN -amount ELSE 0 END),0),
        coalesce(sum(amount) FILTER (WHERE status='approved' AND transaction_type='deposit'),0),
        coalesce(sum(amount) FILTER (WHERE status='approved' AND transaction_type='withdrawal' AND description ILIKE 'Admin deduction%'),0)
   INTO v_balance,v_deposits,v_deduct FROM transactions WHERE account_id=p_account_id;
 SELECT coalesce(sum(amount),0) INTO v_welfare FROM welfare WHERE account_id=p_account_id;
 v_sav := greatest(0,v_deposits-v_welfare-v_deduct);
 UPDATE accounts SET balance=v_balance,total_savings=v_sav,updated_at=now() WHERE id=p_account_id AND (balance IS DISTINCT FROM v_balance OR total_savings IS DISTINCT FROM v_sav);
 WITH running AS (SELECT id,sum(CASE WHEN status='approved' AND transaction_type IN ('deposit','loan_disbursement') THEN amount WHEN status='approved' AND transaction_type IN ('withdrawal','loan_repayment') THEN -amount ELSE 0 END) OVER (ORDER BY created_at,id ROWS UNBOUNDED PRECEDING) AS balance FROM transactions WHERE account_id=p_account_id)
 UPDATE transactions t SET balance_after=r.balance FROM running r WHERE t.id=r.id AND t.balance_after IS DISTINCT FROM r.balance;
END $function$;