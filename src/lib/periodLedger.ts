// Point-in-time ledger: figures "as of" a period end, and flows strictly inside a period.
// Mirrors reconcile_account_ledger (savings = deposits − welfare − admin deductions)
// and the loan rule (owed = total due + overdue charged − repayments, clamped at 0).
import { supabase } from "@/integrations/supabase/client";

export interface LedgerTxn { account_id: string; loan_id?: string | null; transaction_type: string; amount: number | string; description?: string | null; created_at: string; status?: string }
export interface LedgerLoan { id: string; account_id: string; amount: number | string; total_amount: number | string; status: string; disbursed_at: string | null; repayment_months?: number | null; interest_rate?: number | string }
export interface LedgerWelfare { account_id: string; amount: number | string; week_date: string }

const EXCLUDED = ["pending", "rejected"];
const t = (d: string) => new Date(d).getTime();

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = []; const size = 1000;
  for (let i = 0; ; i += size) {
    const { data, error } = await build(i, i + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

/** Loads every approved transaction, loan and welfare row up to `end`. */
export async function loadLedgerUpTo(end: Date) {
  const iso = end.toISOString();
  const [txns, loans, welfare] = await Promise.all([
    fetchAll<LedgerTxn>((a, b) => supabase.from("transactions")
      .select("account_id, loan_id, transaction_type, amount, description, created_at, status")
      .eq("status", "approved").lte("created_at", iso).order("created_at").range(a, b)),
    fetchAll<LedgerLoan>((a, b) => supabase.from("loans")
      .select("id, account_id, amount, total_amount, status, disbursed_at, repayment_months, interest_rate").range(a, b)),
    fetchAll<LedgerWelfare>((a, b) => supabase.from("welfare")
      .select("account_id, amount, week_date").lte("week_date", iso.slice(0, 10)).range(a, b)),
  ]);
  return { txns, loans, welfare };
}

export function savingsAsOf(accountId: string, end: Date, txns: LedgerTxn[], welfare: LedgerWelfare[]) {
  const e = end.getTime(); let dep = 0, ded = 0, wel = 0;
  for (const x of txns) {
    if (x.account_id !== accountId || t(x.created_at) > e) continue;
    if (x.transaction_type === "deposit") dep += Number(x.amount);
    else if (x.transaction_type === "withdrawal" && (x.description || "").toLowerCase().startsWith("admin deduction")) ded += Number(x.amount);
  }
  for (const w of welfare) if (w.account_id === accountId && t(w.week_date) <= e) wel += Number(w.amount);
  return Math.max(0, dep - wel - ded);
}

/** Outstanding on one loan as of `end` (0 if not yet disbursed by then). */
export function loanOwedAsOf(loan: LedgerLoan, end: Date, txns: LedgerTxn[]) {
  if (EXCLUDED.includes(loan.status) || !loan.disbursed_at || t(loan.disbursed_at) > end.getTime()) return 0;
  const e = end.getTime(); let pen = 0, rep = 0;
  for (const x of txns) {
    if (x.loan_id !== loan.id || t(x.created_at) > e) continue;
    if (x.transaction_type === "overdue_interest") pen += Number(x.amount);
    else if (x.transaction_type === "loan_repayment") rep += Number(x.amount);
  }
  return Math.max(0, Number(loan.total_amount) + pen - rep);
}

export function dueDateOf(loan: LedgerLoan) {
  if (!loan.disbursed_at) return null;
  const d = new Date(loan.disbursed_at); d.setMonth(d.getMonth() + (Number(loan.repayment_months) || 1)); return d;
}

/** Days overdue measured at the period end, not today. */
export function daysOverdueAsOf(loan: LedgerLoan, end: Date) {
  const due = dueDateOf(loan); if (!due || end <= due) return 0;
  return Math.floor((end.getTime() - due.getTime()) / 86400000);
}

export function flowsInPeriod(txns: LedgerTxn[], start: Date, end: Date, accountId?: string) {
  const s = start.getTime(), e = end.getTime(); const f: Record<string, number> = {};
  for (const x of txns) {
    const ts = t(x.created_at);
    if (ts < s || ts > e || (accountId && x.account_id !== accountId)) continue;
    f[x.transaction_type] = (f[x.transaction_type] || 0) + Number(x.amount);
  }
  return f;
}

export const PERIOD_NOTE = "Period method: opening figures are as at the start date, closing figures as at the end date; only entries dated inside the period are counted as activity.";

/**
 * Rewrites live account/loan rows so they show their position at `end`:
 * total_savings, balance (savings − owed) and loan outstanding_balance as of that date.
 * Loans not disbursed by `end` are dropped. Returns new arrays.
 */
export async function snapshotAsOf<A extends { id: string }, L extends LedgerLoan & { outstanding_balance?: any }>(
  accounts: A[], loans: L[], end: Date,
) {
  const ledger = await loadLedgerUpTo(end);
  const snapLoans = loans
    .filter(l => !l.disbursed_at || new Date(l.disbursed_at) <= end)
    .map(l => {
      const owed = l.disbursed_at ? loanOwedAsOf(l, end, ledger.txns) : Number(l.outstanding_balance || 0);
      const status = l.disbursed_at && !EXCLUDED.includes(l.status) ? (owed > 0 ? "active" : "fully_paid") : l.status;
      return { ...l, outstanding_balance: owed, status };
    });
  const owedBy: Record<string, number> = {};
  snapLoans.forEach(l => { if (["active", "disbursed", "approved"].includes(l.status)) owedBy[l.account_id] = (owedBy[l.account_id] || 0) + Number(l.outstanding_balance); });
  const snapAccounts = accounts.map(a => {
    const sav = savingsAsOf(a.id, end, ledger.txns, ledger.welfare);
    return { ...a, total_savings: sav, balance: sav - (owedBy[a.id] || 0) };
  });
  return { accounts: snapAccounts, loans: snapLoans, ledger };
}
