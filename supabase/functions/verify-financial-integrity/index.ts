import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Fetch ALL rows by paginating in chunks of 1000 to avoid Supabase's default row cap */
async function fetchAll<T>(
  queryFn: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000;
  const results: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Verify calling user is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Fetch ALL data with pagination ───────────────────────────────────────
    const [accounts, transactions, loans, profiles, subAccountProfiles] = await Promise.all([
      fetchAll((from, to) =>
        admin.from("accounts")
          .select("id, account_number, account_type, balance, total_savings, user_id, parent_account_id")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        admin.from("transactions")
          .select("id, account_id, transaction_type, amount, balance_after, status, loan_id, created_at")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        admin.from("loans")
          .select("id, account_id, amount, total_amount, outstanding_balance, status, interest_rate, repayment_months")
          .range(from, to)
      ),
      fetchAll((from, to) =>
        admin.from("profiles").select("id, full_name, email").range(from, to)
      ),
      fetchAll((from, to) =>
        admin.from("sub_account_profiles").select("account_id, full_name").range(from, to)
      ),
    ]);

    // Build lookup maps
    const profileMap: Record<string, { full_name: string; email: string }> = {};
    for (const p of profiles) profileMap[p.id] = { full_name: p.full_name, email: p.email };

    const subProfileMap: Record<string, string> = {};
    for (const sp of subAccountProfiles) subProfileMap[sp.account_id] = sp.full_name;

    // Helper: resolve owner name for any account
    function ownerName(acc: { id: string; account_type: string; user_id: string }): string {
      if (acc.account_type === "sub") return subProfileMap[acc.id] ?? "Sub-account";
      return profileMap[acc.user_id]?.full_name ?? "Unknown";
    }

    // ── Only approved transactions matter for balance integrity ──────────────
    const approvedTxns = transactions.filter((t) => t.status === "approved");

    // Group by account
    const txnsByAccount: Record<string, typeof approvedTxns> = {};
    for (const t of approvedTxns) {
      if (!txnsByAccount[t.account_id]) txnsByAccount[t.account_id] = [];
      txnsByAccount[t.account_id].push(t);
    }

    // ── Account balance reconciliation ───────────────────────────────────────
    // SOURCE OF TRUTH (matches handleApprove in TransactionsManagement):
    //   balance        = Σdeposit + Σloan_disbursement − Σwithdrawal − Σloan_repayment
    //   total_savings  = Σdeposit  (welfare deductions directly reduce this field outside txn flow)
    //
    // NOTE: "welfare_deduction" is NOT a transaction type — welfare is recorded as "withdrawal".
    //       "interest_received" and "overdue_interest" have balance_after=0 and do NOT affect cash balance.

    interface AccountReport {
      account_id: string;
      account_number: string;
      account_type: string;
      owner_name: string;
      stored_balance: number;
      calculated_balance: number;
      balance_discrepancy: number;
      stored_savings: number;
      calculated_savings: number;
      savings_discrepancy: number;
      total_deposits: number;
      total_withdrawals: number;
      total_loan_disbursements: number;
      total_loan_repayments: number;
      transaction_count: number;
    }

    interface LoanReport {
      loan_id: string;
      account_number: string;
      owner_name: string;
      principal: number;
      total_amount: number;
      stored_outstanding: number;
      calculated_outstanding: number;
      discrepancy: number;
      total_repaid: number;
      status: string;
    }

    const accountReports: AccountReport[] = [];
    let totalDiscrepancies = 0;

    for (const acc of accounts) {
      const acctTxns = txnsByAccount[acc.id] ?? [];

      const deposits = acctTxns
        .filter((t) => t.transaction_type === "deposit")
        .reduce((s, t) => s + Number(t.amount), 0);

      const withdrawals = acctTxns
        .filter((t) => t.transaction_type === "withdrawal")
        .reduce((s, t) => s + Number(t.amount), 0);

      const loanDisbursements = acctTxns
        .filter((t) => t.transaction_type === "loan_disbursement")
        .reduce((s, t) => s + Number(t.amount), 0);

      const loanRepayments = acctTxns
        .filter((t) => t.transaction_type === "loan_repayment")
        .reduce((s, t) => s + Number(t.amount), 0);

      // Exact formula from handleApprove (TransactionsManagement.tsx line 372-376):
      // interest_received and overdue_interest are excluded — they don't affect cash balance
      const calcBalance = deposits + loanDisbursements - withdrawals - loanRepayments;

      // Savings = deposits only (formula from handleApprove line 377-379)
      // NOTE: welfare deductions also reduce total_savings directly via account update — so
      // calculated_savings may differ from stored; we report the difference without flagging
      // as a hard error since the stored value is the authoritative figure for savings.
      const calcSavings = deposits;

      const balanceDiff = Math.round((Number(acc.balance) - calcBalance) * 100) / 100;
      const savingsDiff = Math.round((Number(acc.total_savings) - calcSavings) * 100) / 100;

      // Only flag BALANCE discrepancies as errors; savings diff is informational
      // (savings is reduced by welfare outside the transaction flow, so a negative diff is expected)
      if (Math.abs(balanceDiff) > 0.01) totalDiscrepancies++;

      accountReports.push({
        account_id: acc.id,
        account_number: acc.account_number,
        account_type: acc.account_type,
        owner_name: ownerName(acc),
        stored_balance: Math.round(Number(acc.balance) * 100) / 100,
        calculated_balance: Math.round(calcBalance * 100) / 100,
        balance_discrepancy: balanceDiff,
        stored_savings: Math.round(Number(acc.total_savings) * 100) / 100,
        calculated_savings: Math.round(calcSavings * 100) / 100,
        savings_discrepancy: savingsDiff,
        total_deposits: Math.round(deposits * 100) / 100,
        total_withdrawals: Math.round(withdrawals * 100) / 100,
        total_loan_disbursements: Math.round(loanDisbursements * 100) / 100,
        total_loan_repayments: Math.round(loanRepayments * 100) / 100,
        transaction_count: acctTxns.length,
      });
    }

    // ── Loan outstanding balance reconciliation ──────────────────────────────
    // Outstanding = total_amount + overdue_interest_accrued − loan_repayments
    // interest_received is an informational split of a repayment, NOT an additional deduction
    // (outstanding is already reduced by the full loan_repayment amount in handleApprove)
    const repaymentsByLoan: Record<string, number> = {};
    const overdueInterestByLoan: Record<string, number> = {};

    for (const t of approvedTxns) {
      if (!t.loan_id) continue;
      if (t.transaction_type === "loan_repayment") {
        repaymentsByLoan[t.loan_id] = (repaymentsByLoan[t.loan_id] ?? 0) + Number(t.amount);
      }
      // "overdue_interest" is the exact type set by apply-overdue-interest edge function
      if (t.transaction_type === "overdue_interest") {
        overdueInterestByLoan[t.loan_id] = (overdueInterestByLoan[t.loan_id] ?? 0) + Number(t.amount);
      }
    }

    const loanReports: LoanReport[] = [];
    let loanDiscrepancies = 0;

    for (const loan of loans) {
      const repaid = repaymentsByLoan[loan.id] ?? 0;
      const overdueAccrued = overdueInterestByLoan[loan.id] ?? 0;

      const calcOutstanding = Math.max(Number(loan.total_amount) + overdueAccrued - repaid, 0);
      const storedOutstanding = Math.round(Number(loan.outstanding_balance) * 100) / 100;
      const diff = Math.round((storedOutstanding - calcOutstanding) * 100) / 100;

      if (Math.abs(diff) > 0.01) loanDiscrepancies++;

      const accInfo = accounts.find((a) => a.id === loan.account_id);
      const name = accInfo ? ownerName(accInfo) : "Unknown";

      loanReports.push({
        loan_id: loan.id,
        account_number: accInfo?.account_number ?? "Unknown",
        owner_name: name,
        principal: Number(loan.amount),
        total_amount: Number(loan.total_amount),
        stored_outstanding: storedOutstanding,
        calculated_outstanding: Math.round(calcOutstanding * 100) / 100,
        discrepancy: diff,
        total_repaid: Math.round(repaid * 100) / 100,
        status: loan.status,
      });
    }

    // ── Summary statistics ───────────────────────────────────────────────────
    const summaryByType: Record<string, number> = {};
    for (const t of approvedTxns) {
      summaryByType[t.transaction_type] = (summaryByType[t.transaction_type] ?? 0) + Number(t.amount);
    }

    const grandTotalDeposits = summaryByType["deposit"] ?? 0;
    const grandTotalWithdrawals = summaryByType["withdrawal"] ?? 0;
    const grandTotalLoanDisbursements = summaryByType["loan_disbursement"] ?? 0;
    const grandTotalLoanRepayments = summaryByType["loan_repayment"] ?? 0;
    const grandTotalOverdueInterest = summaryByType["overdue_interest"] ?? 0;
    const grandTotalInterestReceived = summaryByType["interest_received"] ?? 0;

    const totalStoredBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalCalcBalance = accountReports.reduce((s, a) => s + a.calculated_balance, 0);
    const totalStoredSavings = accounts.reduce((s, a) => s + Number(a.total_savings), 0);
    const totalCalcSavings = accountReports.reduce((s, a) => s + a.calculated_savings, 0);

    // ── Build AI prompt ──────────────────────────────────────────────────────
    const discrepantAccounts = accountReports.filter((a) => Math.abs(a.balance_discrepancy) > 0.01);
    const discrepantLoans = loanReports.filter((l) => Math.abs(l.discrepancy) > 0.01);

    const summaryPrompt = `
You are a certified SACCO financial auditor AI. Analyze this financial integrity report and provide a professional, clear audit summary.

SYSTEM TOTALS:
- Total Members: ${accounts.filter((a) => a.account_type === "main").length}
- Total Accounts (including sub): ${accounts.length}
- Total Approved Transactions: ${approvedTxns.length}
- Total Loans: ${loans.length}

TRANSACTION TYPE TOTALS (approved only):
- Total Deposits: UGX ${grandTotalDeposits.toFixed(2)}
- Total Withdrawals (includes welfare deductions): UGX ${grandTotalWithdrawals.toFixed(2)}
- Total Loan Disbursements: UGX ${grandTotalLoanDisbursements.toFixed(2)}
- Total Loan Repayments: UGX ${grandTotalLoanRepayments.toFixed(2)}
- Total Interest Received: UGX ${grandTotalInterestReceived.toFixed(2)}
- Total Overdue Interest Accrued: UGX ${grandTotalOverdueInterest.toFixed(2)}

BALANCE INTEGRITY:
- Stored Total Balance (all accounts): UGX ${totalStoredBalance.toFixed(2)}
- Recalculated Total Balance: UGX ${totalCalcBalance.toFixed(2)}
- Balance Difference: UGX ${(totalStoredBalance - totalCalcBalance).toFixed(2)}
- Stored Total Savings: UGX ${totalStoredSavings.toFixed(2)}
- Gross Deposit Total (before welfare deductions): UGX ${totalCalcSavings.toFixed(2)}
- Savings Difference (expected negative — welfare reduces savings outside transaction flow): UGX ${(totalStoredSavings - totalCalcSavings).toFixed(2)}

ACCOUNT BALANCE DISCREPANCIES: ${totalDiscrepancies} account(s) with issues
${discrepantAccounts.slice(0, 10).map((a) => `  - ${a.owner_name} (${a.account_number}): Balance diff UGX ${a.balance_discrepancy}`).join("\n")}

LOAN DISCREPANCIES: ${loanDiscrepancies} loan(s) with issues
${discrepantLoans.slice(0, 10).map((l) => `  - ${l.owner_name} (${l.account_number}): Outstanding diff UGX ${l.discrepancy} [${l.status}]`).join("\n")}

NET SACCO POSITION:
- Net Cash Flow = Deposits − Withdrawals = UGX ${(grandTotalDeposits - grandTotalWithdrawals).toFixed(2)}
- Total Active Loan Exposure = UGX ${loans.filter((l) => ["active", "disbursed", "approved"].includes(l.status)).reduce((s, l) => s + Number(l.outstanding_balance), 0).toFixed(2)}
- Total Interest Income = UGX ${(grandTotalInterestReceived + grandTotalOverdueInterest).toFixed(2)}

Accounting rules used:
1. Cash Balance = Deposits + Loan Disbursements − Withdrawals − Loan Repayments
   (Welfare deductions are recorded as "withdrawal" transactions)
   (interest_received and overdue_interest do NOT affect cash balance)
2. Total Savings = Gross deposit total minus welfare deductions applied directly to savings field
3. Loan Outstanding = Loan Total Amount + Overdue Interest Accrued − Loan Repayments
   (interest_received is informational only and is NOT double-deducted)

Provide:
1. An OVERALL HEALTH STATUS (Healthy / Minor Issues / Critical Issues)
2. A brief executive summary (2-3 sentences)
3. Key findings (bullet points)
4. Specific recommendations if any discrepancies exist
5. A final sign-off statement

Be direct, professional, and use UGX currency formatting throughout.
`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a certified SACCO financial auditor. Provide clear, concise, professional audit reports." },
          { role: "user", content: summaryPrompt },
        ],
        stream: false,
      }),
    });

    let aiReport = "AI analysis unavailable.";
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      aiReport = aiData.choices?.[0]?.message?.content ?? aiReport;
    } else if (aiResponse.status === 429) {
      aiReport = "⚠️ Rate limit reached. The financial data below is still accurate — AI narrative is temporarily unavailable.";
    } else if (aiResponse.status === 402) {
      aiReport = "⚠️ Lovable AI credits exhausted. The financial data below is still accurate.";
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_at: new Date().toISOString(),
        ai_report: aiReport,
        summary: {
          total_accounts: accounts.length,
          total_transactions: approvedTxns.length,
          total_loans: loans.length,
          account_discrepancies: totalDiscrepancies,
          loan_discrepancies: loanDiscrepancies,
          grand_totals: {
            deposits: grandTotalDeposits,
            withdrawals: grandTotalWithdrawals,
            loan_disbursements: grandTotalLoanDisbursements,
            loan_repayments: grandTotalLoanRepayments,
            welfare_deductions: grandTotalWithdrawals, // withdrawals = cash outflows incl. welfare
          },
          balance_integrity: {
            stored_total_balance: totalStoredBalance,
            calculated_total_balance: totalCalcBalance,
            balance_difference: totalStoredBalance - totalCalcBalance,
            stored_total_savings: totalStoredSavings,
            calculated_total_savings: totalCalcSavings,
            savings_difference: totalStoredSavings - totalCalcSavings,
          },
        },
        account_reports: accountReports,
        loan_reports: loanReports,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Integrity check error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
