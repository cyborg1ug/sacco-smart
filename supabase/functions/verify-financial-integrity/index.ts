import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check — must be admin
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

    // Use service role for full data access
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Fetch all data in parallel ──────────────────────────────────────────
    const [accountsRes, transactionsRes, loansRes, profilesRes] = await Promise.all([
      admin.from("accounts").select("id, account_number, account_type, balance, total_savings, user_id, parent_account_id"),
      admin.from("transactions").select("id, account_id, transaction_type, amount, balance_after, status, loan_id, created_at"),
      admin.from("loans").select("id, account_id, amount, total_amount, outstanding_balance, status, interest_rate"),
      admin.from("profiles").select("id, full_name, email"),
    ]);

    const accounts = accountsRes.data ?? [];
    const transactions = transactionsRes.data ?? [];
    const loans = loansRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const profileMap: Record<string, { full_name: string; email: string }> = {};
    for (const p of profiles) profileMap[p.id] = { full_name: p.full_name, email: p.email };

    // ── Recalculate balances from approved transactions ────────────────────
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

    const approvedTxns = transactions.filter((t) => t.status === "approved");

    // Group by account
    const txnsByAccount: Record<string, typeof approvedTxns> = {};
    for (const t of approvedTxns) {
      if (!txnsByAccount[t.account_id]) txnsByAccount[t.account_id] = [];
      txnsByAccount[t.account_id].push(t);
    }

    const accountReports: AccountReport[] = [];
    let totalDiscrepancies = 0;

    for (const acc of accounts) {
      const acctTxns = txnsByAccount[acc.id] ?? [];
      const deposits = acctTxns.filter((t) => t.transaction_type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
      const withdrawals = acctTxns.filter((t) => t.transaction_type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);
      const loanDisbursements = acctTxns.filter((t) => t.transaction_type === "loan_disbursement").reduce((s, t) => s + Number(t.amount), 0);
      const loanRepayments = acctTxns.filter((t) => t.transaction_type === "loan_repayment").reduce((s, t) => s + Number(t.amount), 0);
      const welfareDeductions = acctTxns.filter((t) => t.transaction_type === "welfare_deduction").reduce((s, t) => s + Number(t.amount), 0);
      // overdue_interest: penalty charged as a debit against the account balance
      const overdueInterest = acctTxns.filter((t) => t.transaction_type === "overdue_interest").reduce((s, t) => s + Number(t.amount), 0);
      // interest_received: SACCO-side interest income credited to the account
      const interestReceived = acctTxns.filter((t) => t.transaction_type === "interest_received").reduce((s, t) => s + Number(t.amount), 0);

      // Balance = Deposits + LoanDisbursements + InterestReceived - Withdrawals - LoanRepayments - WelfareDeductions - OverdueInterest
      const calcBalance = deposits + loanDisbursements + interestReceived - withdrawals - loanRepayments - welfareDeductions - overdueInterest;
      // Total Savings = sum of approved deposits only
      const calcSavings = deposits;


      const balanceDiff = Math.round((Number(acc.balance) - calcBalance) * 100) / 100;
      const savingsDiff = Math.round((Number(acc.total_savings) - calcSavings) * 100) / 100;

      if (Math.abs(balanceDiff) > 0.01 || Math.abs(savingsDiff) > 0.01) totalDiscrepancies++;

      const profile = acc.account_type === "main" ? profileMap[acc.user_id] : null;
      const ownerName = profile?.full_name ?? "Sub-account";

      accountReports.push({
        account_id: acc.id,
        account_number: acc.account_number,
        account_type: acc.account_type,
        owner_name: ownerName,
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

    // ── Loan outstanding balance check ─────────────────────────────────────
    // Outstanding = total_amount + penalties_accrued - loan_repayments
    // Penalties are added directly to outstanding_balance by the apply-overdue-interest function.
    // So: calc = total_amount + sum(penalty_interest txns) - sum(loan_repayment txns)
    const repaymentsByLoan: Record<string, number> = {};
    const penaltiesByLoan: Record<string, number> = {};
    for (const t of approvedTxns) {
      if (t.loan_id) {
        if (t.transaction_type === "loan_repayment") {
          repaymentsByLoan[t.loan_id] = (repaymentsByLoan[t.loan_id] ?? 0) + Number(t.amount);
        }
        if (t.transaction_type === "penalty_interest" || t.transaction_type === "interest_accrual") {
          penaltiesByLoan[t.loan_id] = (penaltiesByLoan[t.loan_id] ?? 0) + Number(t.amount);
        }
      }
    }

    const loanReports: LoanReport[] = [];
    let loanDiscrepancies = 0;

    for (const loan of loans) {
      const repaid = repaymentsByLoan[loan.id] ?? 0;
      const penalties = penaltiesByLoan[loan.id] ?? 0;
      // Base: total_amount (principal+fixed interest) + any recorded penalty transactions - repayments
      // Overdue interest applied directly to outstanding_balance (no txn record) is valid;
      // we verify: stored_outstanding >= (total_amount - repaid) i.e. repayments were correctly subtracted
      const minExpected = Math.max(Number(loan.total_amount) + penalties - repaid, 0);
      // Only flag if stored is LESS than calculated (indicates repayments not reflected)
      const diff = Math.round((Number(loan.outstanding_balance) - minExpected) * 100) / 100;
      // Only flag if stored is LESS than expected (repayments not reflected = real error)
      // Positive diff = penalty accruals = healthy
      const isDiscrepancy = diff < -0.01;
      if (isDiscrepancy) loanDiscrepancies++;

      const accInfo = accounts.find((a) => a.id === loan.account_id);
      const ownerProfile = accInfo ? profileMap[accInfo.user_id] : null;
      // For display: calculated = minExpected; stored may be higher due to penalty accruals
      const calcOutstanding = minExpected;

      loanReports.push({
        loan_id: loan.id,
        account_number: accInfo?.account_number ?? "Unknown",
        owner_name: ownerProfile?.full_name ?? "Unknown",
        principal: Number(loan.amount),
        total_amount: Number(loan.total_amount),
        stored_outstanding: Math.round(Number(loan.outstanding_balance) * 100) / 100,
        calculated_outstanding: Math.round(calcOutstanding * 100) / 100,
        discrepancy: diff,
        total_repaid: Math.round(repaid * 100) / 100,
        status: loan.status,
      });
    }

    // ── Summary statistics ─────────────────────────────────────────────────
    const allApproved = approvedTxns;
    const summaryByType: Record<string, number> = {};
    for (const t of allApproved) {
      summaryByType[t.transaction_type] = (summaryByType[t.transaction_type] ?? 0) + Number(t.amount);
    }

    const grandTotalDeposits = summaryByType["deposit"] ?? 0;
    const grandTotalWithdrawals = summaryByType["withdrawal"] ?? 0;
    const grandTotalLoanDisbursements = summaryByType["loan_disbursement"] ?? 0;
    const grandTotalLoanRepayments = summaryByType["loan_repayment"] ?? 0;
    const grandTotalWelfare = summaryByType["welfare_deduction"] ?? 0;

    const totalStoredBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalCalcBalance = accountReports.reduce((s, a) => s + a.calculated_balance, 0);
    const totalStoredSavings = accounts.reduce((s, a) => s + Number(a.total_savings), 0);
    const totalCalcSavings = accountReports.reduce((s, a) => s + a.calculated_savings, 0);

    // ── Build AI prompt ────────────────────────────────────────────────────
    const discrepantAccounts = accountReports.filter((a) => Math.abs(a.balance_discrepancy) > 0.01 || Math.abs(a.savings_discrepancy) > 0.01);
    const discrepantLoans = loanReports.filter((l) => Math.abs(l.discrepancy) > 0.01);

    const summaryPrompt = `
You are a certified SACCO financial auditor AI. Analyze this financial integrity report and provide a professional, clear audit summary.

SYSTEM TOTALS:
- Total Members: ${accounts.filter((a) => a.account_type === "main").length}
- Total Accounts (including sub): ${accounts.length}
- Total Approved Transactions: ${allApproved.length}
- Total Loans: ${loans.length}

TRANSACTION TYPE TOTALS (approved only):
- Total Deposits: UGX ${grandTotalDeposits.toFixed(2)}
- Total Withdrawals: UGX ${grandTotalWithdrawals.toFixed(2)}
- Total Loan Disbursements: UGX ${grandTotalLoanDisbursements.toFixed(2)}
- Total Loan Repayments: UGX ${grandTotalLoanRepayments.toFixed(2)}
- Total Welfare Deductions: UGX ${grandTotalWelfare.toFixed(2)}

BALANCE INTEGRITY:
- Stored Total Balance (all accounts): UGX ${totalStoredBalance.toFixed(2)}
- Recalculated Total Balance: UGX ${totalCalcBalance.toFixed(2)}
- Balance Difference: UGX ${(totalStoredBalance - totalCalcBalance).toFixed(2)}
- Stored Total Savings: UGX ${totalStoredSavings.toFixed(2)}
- Recalculated Total Savings: UGX ${totalCalcSavings.toFixed(2)}
- Savings Difference: UGX ${(totalStoredSavings - totalCalcSavings).toFixed(2)}

ACCOUNT DISCREPANCIES: ${totalDiscrepancies} account(s) with issues
${discrepantAccounts.slice(0, 10).map((a) => `  - ${a.owner_name} (${a.account_number}): Balance diff UGX ${a.balance_discrepancy}, Savings diff UGX ${a.savings_discrepancy}`).join("\n")}

LOAN DISCREPANCIES: ${loanDiscrepancies} loan(s) with issues
${discrepantLoans.slice(0, 10).map((l) => `  - ${l.owner_name} (${l.account_number}): Outstanding diff UGX ${l.discrepancy} [${l.status}]`).join("\n")}

NET SACCO POSITION:
- Net Flow = Deposits - Withdrawals - Welfare = UGX ${(grandTotalDeposits - grandTotalWithdrawals - grandTotalWelfare).toFixed(2)}
- Total Active Loan Exposure = UGX ${loans.filter((l) => ["active", "disbursed", "approved"].includes(l.status)).reduce((s, l) => s + Number(l.outstanding_balance), 0).toFixed(2)}

Accounting rules used:
1. Available Balance = Deposits + Loan Disbursements - Withdrawals - Loan Repayments - Welfare Deductions
2. Total Savings = Sum of approved deposit transactions only
3. Loan Outstanding = Loan Total Amount - Sum of approved loan repayment transactions

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
          total_transactions: allApproved.length,
          total_loans: loans.length,
          account_discrepancies: totalDiscrepancies,
          loan_discrepancies: loanDiscrepancies,
          grand_totals: {
            deposits: grandTotalDeposits,
            withdrawals: grandTotalWithdrawals,
            loan_disbursements: grandTotalLoanDisbursements,
            loan_repayments: grandTotalLoanRepayments,
            welfare_deductions: grandTotalWelfare,
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
