// Net account balance utilities.
//
// Business rule (KINONI SACCO): a member's account balance is presented as their
// TOTAL SAVINGS reduced by any ACTIVE loan they currently owe:
//
//     account balance = total_savings - outstanding(active loans)
//
// "Active" loans are those still owed money (status approved/disbursed/active and
// outstanding_balance > 0). This is a display-layer derivation — the raw cash
// ledger (accounts.balance / transactions.balance_after) and the integrity
// checker that reconciles it are intentionally left untouched.

import { supabase } from "@/integrations/supabase/client";

export const ACTIVE_LOAN_STATUSES = ["approved", "disbursed", "active"];

/** Net account balance = total savings minus outstanding active-loan balances. */
export const netAccountBalance = (
  totalSavings: number | string | null | undefined,
  outstandingLoans: number | string | null | undefined
): number => Number(totalSavings || 0) - Number(outstandingLoans || 0);

/**
 * Sum of outstanding balances of ACTIVE loans, keyed by account_id.
 * Accounts with no active loan are simply absent from the map (treat as 0).
 */
export async function fetchOutstandingByAccount(
  accountIds: string[]
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data } = await supabase
    .from("loans")
    .select("account_id, outstanding_balance, status")
    .in("account_id", ids)
    .in("status", ACTIVE_LOAN_STATUSES)
    .gt("outstanding_balance", 0);

  for (const l of data || []) {
    map[l.account_id] = (map[l.account_id] || 0) + Number(l.outstanding_balance);
  }
  return map;
}

/** Convenience: outstanding active-loan total for a single account. */
export async function fetchOutstandingForAccount(accountId: string): Promise<number> {
  const map = await fetchOutstandingByAccount([accountId]);
  return map[accountId] || 0;
}
