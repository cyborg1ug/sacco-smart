import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { reportType, data } = await req.json();

    const buildPrompt = (type: string, d: any): string => {
      if (type === "member") {
        const overdueInfo = d.overdueLoans?.length > 0
          ? `OVERDUE LOANS: ${d.overdueLoans.map((l: any) => `Principal UGX ${l.amount?.toLocaleString()}, Outstanding UGX ${l.outstanding_balance?.toLocaleString()}, ${l.daysOverdue} days overdue`).join("; ")}`
          : "No overdue loans.";

        return `You are a professional SACCO financial analyst for KINONI SACCO (Uganda). Analyze this member's financial data and produce a structured bank-quality financial analysis report.

MEMBER: ${d.memberName} | Account: ${d.accountNumber}
Report Period: ${d.period}
Generated: ${d.generatedAt}

ACCOUNT BALANCES:
- Current Balance: UGX ${d.balance?.toLocaleString()}
- Total Savings (all-time): UGX ${d.totalSavings?.toLocaleString()}

ALL-TIME TOTALS:
- Total Deposits: UGX ${d.totalDeposits?.toLocaleString()}
- Total Withdrawals: UGX ${d.totalWithdrawals?.toLocaleString()}
- Net Deposits: UGX ${(d.totalDeposits - d.totalWithdrawals)?.toLocaleString()}
- Loan Disbursements: UGX ${d.totalDisbursements?.toLocaleString()}
- Loan Repayments: UGX ${d.totalRepayments?.toLocaleString()}
- Interest Paid: UGX ${d.totalInterest?.toLocaleString()}

PERIOD ACTIVITY:
- Deposits: UGX ${d.periodDeposits?.toLocaleString()}
- Withdrawals: UGX ${d.periodWithdrawals?.toLocaleString()}
- Disbursements: UGX ${d.periodDisbursements?.toLocaleString()}
- Repayments: UGX ${d.periodRepayments?.toLocaleString()}

LOAN STATUS: ${d.activeLoansCount} active, ${d.completedLoansCount} completed
${overdueInfo}

SAVINGS CONSISTENCY: ${d.savingsRecords} weekly savings records in period, total UGX ${d.periodSavings?.toLocaleString()}

Write a structured report with these exact sections:
1. EXECUTIVE SUMMARY (3-4 sentences overall assessment)
2. FINANCIAL HEALTH ASSESSMENT (score out of 10 with justification)
3. SAVINGS BEHAVIOUR ANALYSIS (trends, consistency, recommendations)
4. LOAN PORTFOLIO ANALYSIS (repayment performance, risk assessment)
5. RISK FLAGS (list any concerns — overdue loans, low savings, irregular activity)
6. RECOMMENDATIONS (3-5 specific, actionable recommendations for this member)
7. AUDITOR'S NOTE (data integrity confirmation or caveats)

Use professional financial language appropriate for a bank statement. Use UGX currency. Be specific with numbers.`;
      }

      // Group report
      return `You are a professional SACCO financial analyst for KINONI SACCO (Uganda). Analyze this SACCO's collective financial data and produce a comprehensive bank-quality audit report.

Report Period: ${d.period}
Generated: ${d.generatedAt}

MEMBERSHIP:
- Total Members: ${d.totalMembers}
- Main Accounts: ${d.mainAccounts}
- Sub-Accounts: ${d.subAccounts}

COMBINED BALANCES:
- Total Balance: UGX ${d.totalBalance?.toLocaleString()}
- Total Savings (all-time): UGX ${d.totalSavings?.toLocaleString()}

ALL-TIME FINANCIAL TOTALS:
- All Deposits: UGX ${d.allTimeDeposits?.toLocaleString()}
- All Withdrawals: UGX ${d.allTimeWithdrawals?.toLocaleString()}
- Net Deposits: UGX ${(d.allTimeDeposits - d.allTimeWithdrawals)?.toLocaleString()}
- Total Disbursements: UGX ${d.allTimeDisbursements?.toLocaleString()}
- Total Repayments: UGX ${d.allTimeRepayments?.toLocaleString()}
- Total Interest Received: UGX ${d.allTimeInterest?.toLocaleString()}

PERIOD ACTIVITY:
- Deposits: UGX ${d.periodDeposits?.toLocaleString()}
- Withdrawals: UGX ${d.periodWithdrawals?.toLocaleString()}
- Disbursements: UGX ${d.periodDisbursements?.toLocaleString()}
- Repayments: UGX ${d.periodRepayments?.toLocaleString()}
- Interest Income: UGX ${d.periodInterest?.toLocaleString()}

LOAN PORTFOLIO:
- Active Loans: ${d.activeLoans}
- Total Outstanding: UGX ${d.totalOutstanding?.toLocaleString()}
- Overdue Loans: ${d.overdueLoans} (UGX ${d.totalOverdueBalance?.toLocaleString()} outstanding)
- Total Overdue Penalties Accrued: UGX ${d.totalOverduePenalty?.toLocaleString()}
- Pending Approvals: ${d.pendingLoans}
- Completed Loans: ${d.completedLoans}

FINANCIAL RATIOS:
- Loan-to-Savings Ratio: ${d.totalSavings > 0 ? ((d.totalOutstanding / d.totalSavings) * 100).toFixed(1) : 0}%
- Overdue Rate: ${d.activeLoans > 0 ? ((d.overdueLoans / d.activeLoans) * 100).toFixed(1) : 0}%
- Recovery Rate: ${d.allTimeDisbursements > 0 ? ((d.allTimeRepayments / d.allTimeDisbursements) * 100).toFixed(1) : 0}%
- Interest Income Yield: ${d.allTimeDisbursements > 0 ? ((d.allTimeInterest / d.allTimeDisbursements) * 100).toFixed(2) : 0}%

Write a structured report with these exact sections:
1. EXECUTIVE SUMMARY (4-5 sentences overall SACCO health assessment)
2. FINANCIAL PERFORMANCE INDICATORS (analyze all key ratios above with interpretation)
3. LOAN PORTFOLIO HEALTH (detailed analysis of portfolio quality, overdue situation, recovery)
4. SAVINGS MOBILISATION ANALYSIS (savings growth, member participation, trends)
5. RISK ASSESSMENT (portfolio risk level — Low/Medium/High — with justification)
6. REGULATORY & COMPLIANCE NOTES (observations relevant to Uganda SACCO regulations)
7. STRATEGIC RECOMMENDATIONS (5-7 specific recommendations for SACCO management)
8. AUDITOR'S CERTIFICATION NOTE (confirmation of data basis and limitations)

Use professional financial language appropriate for a bank audit report. Use UGX currency. Be specific with numbers and percentages.`;
    };

    const prompt = buildPrompt(reportType, data);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a senior financial analyst at a reputable Ugandan financial institution. You produce professional, accurate, and actionable financial reports in bank audit style. Always be precise with numbers, use formal language, and flag risks clearly.",
          },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your Lovable workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-report-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
