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
      if (type === "audit") {
        const entryLabel = d.entryTypeLabel || d.entryType;
        const top = (d.topRecords || []).slice(0, 15).map((r: any, i: number) =>
          `${i + 1}. ${r.label} — UGX ${Number(r.amount || 0).toLocaleString()}${r.extra ? ` (${r.extra})` : ""}`
        ).join("\n") || "No records in this period.";

        const memberBreak = (d.memberBreakdown || []).slice(0, 15).map((m: any, i: number) =>
          `${i + 1}. ${m.name} (${m.accountNumber}) — Count: ${m.count}, Total: UGX ${Number(m.total).toLocaleString()}`
        ).join("\n") || "No member activity.";

        return `You are a senior SACCO auditor for KINONI SACCO (Uganda). Conduct a DEEP FORENSIC AUDIT focused exclusively on the entry type: ${entryLabel}.

Report Period: ${d.period}
Generated: ${d.generatedAt}
Entry Type Audited: ${entryLabel}

AGGREGATE FIGURES (${entryLabel}):
- Total Records in Period: ${d.recordCount}
- Total Value in Period: UGX ${Number(d.periodTotal).toLocaleString()}
- All-Time Records: ${d.allTimeCount}
- All-Time Total: UGX ${Number(d.allTimeTotal).toLocaleString()}
- Average Transaction Size: UGX ${Number(d.avgAmount).toLocaleString()}
- Largest Single Entry: UGX ${Number(d.maxAmount).toLocaleString()}
- Smallest Single Entry: UGX ${Number(d.minAmount).toLocaleString()}
- Unique Members Involved: ${d.uniqueMembers}
- Period vs All-Time Share: ${d.allTimeTotal > 0 ? ((d.periodTotal / d.allTimeTotal) * 100).toFixed(1) : 0}%

${d.extraMetrics ? `SPECIALISED METRICS:\n${d.extraMetrics}\n` : ""}
TOP 15 ENTRIES BY VALUE:
${top}

TOP 15 MEMBERS BY ACTIVITY:
${memberBreak}

Write a thorough audit report with these EXACT sections:

1. AUDIT SCOPE & METHODOLOGY (2-3 sentences explaining what was audited and how)
2. EXECUTIVE SUMMARY (4-5 sentences — overall health of this entry type)
3. KEY FINDINGS (5-7 bullet observations from the data — concentrations, anomalies, trends)
4. STATISTICAL ANALYSIS (deep numerical interpretation — averages, distribution, member concentration ratios)
5. RISK FLAGS & ANOMALIES (specific concerns: unusual volumes, single-member concentration, missing controls, irregular patterns) — explicitly state if NONE found
6. COMPLIANCE OBSERVATIONS (relevance to Uganda SACCO regulations and internal controls)
7. AI REMARKS (clear professional remarks summarising the auditor's verdict — Healthy / Watch / Concern)
8. RECOMMENDATIONS TO COUNTERACT REMARKS (5-7 SPECIFIC actionable steps to address each remark or risk; if no risks, give 3 recommendations to maintain quality)
9. SUGGESTED FOLLOW-UP ACTIONS (3-5 immediate next steps for management)
10. AUDITOR'S CERTIFICATION NOTE

Use UGX currency throughout. Be precise with numbers and percentages. Speak directly and professionally as a forensic auditor.`;
      }

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
