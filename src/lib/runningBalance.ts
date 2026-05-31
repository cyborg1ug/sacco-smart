// Bank-style running ledger balance utilities.
// Instead of summing buckets, the account balance is presented as a running
// difference: each posted (approved) transaction credits or debits the prior
// balance, exactly like a bank statement.

export interface BalanceTxn {
  transaction_type: string;
  amount: number | string;
  status: string;
  created_at: string;
}

/**
 * Cash-balance effect of a transaction type.
 *  +1 → credit (increases available balance): deposit, loan_disbursement
 *  -1 → debit  (decreases available balance): withdrawal, loan_repayment
 *   0 → no cash effect: interest_received, overdue_interest, welfare_deduction
 */
export const balanceEffect = (type: string): number => {
  switch (type) {
    case "deposit":
    case "loan_disbursement":
      return 1;
    case "withdrawal":
    case "loan_repayment":
      return -1;
    default:
      return 0;
  }
};

/**
 * Attach a `running_balance` to each transaction, computed chronologically as a
 * difference from the opening balance. Only APPROVED transactions move the
 * balance; pending/rejected rows carry the balance forward unchanged.
 *
 * Input order is preserved in the returned array (so a descending list stays
 * descending) while the running balance is always computed oldest → newest.
 */
export function withRunningBalance<T extends BalanceTxn>(
  txns: T[],
  opening = 0
): (T & { running_balance: number })[] {
  const asc = [...txns].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let balance = opening;
  const map = new Map<T, number>();
  for (const t of asc) {
    if (t.status === "approved") {
      balance += balanceEffect(t.transaction_type) * Number(t.amount);
    }
    map.set(t, balance);
  }
  return txns.map((t) => ({ ...t, running_balance: map.get(t) ?? balance }));
}

/**
 * Opening balance for a period = the running balance of all approved
 * transactions strictly BEFORE `periodStart`.
 */
export function openingBalanceBefore(txns: BalanceTxn[], periodStart: Date): number {
  return txns
    .filter((t) => t.status === "approved" && new Date(t.created_at) < periodStart)
    .reduce((bal, t) => bal + balanceEffect(t.transaction_type) * Number(t.amount), 0);
}
