import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      accountId,
      loanAmount,
      repaymentMonths,
      guarantorAccountId,
    }: {
      accountId: string;
      loanAmount: number;
      repaymentMonths: number;
      guarantorAccountId?: string;
    } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Missing accountId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Fetch applicant account ──────────────────────────────────────────
    const { data: account } = await supabase
      .from("accounts")
      .select("id, account_number, account_type, balance, total_savings, parent_account_id, user_id")
      .eq("id", accountId)
      .single();

    if (!account) throw new Error("Account not found");

    // ── 2. Applicant name ───────────────────────────────────────────────────
    let applicantName = "Unknown";
    if (account.account_type === "sub") {
      const { data: subProfile } = await supabase
        .from("sub_account_profiles")
        .select("full_name")
        .eq("account_id", accountId)
        .single();
      applicantName = subProfile?.full_name ?? account.account_number;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", account.user_id)
        .single();
      applicantName = profile?.full_name ?? account.account_number;
    }

    // ── 3. Existing active loans on this account ────────────────────────────
    const { data: existingLoans } = await supabase
      .from("loans")
      .select("id, amount, outstanding_balance, status, created_at")
      .eq("account_id", accountId)
      .in("status", ["pending", "approved", "disbursed", "active"]);

    const hasActiveLoan = (existingLoans ?? []).some(
      (l) => l.outstanding_balance > 0,
    );

    // ── 4. Guarantor info (if provided) ─────────────────────────────────────
    let guarantorInfo: {
      name: string;
      account_number: string;
      total_savings: number;
      account_type: string;
      activeGuaranteeCount: number;
    } | null = null;

    if (guarantorAccountId) {
      const { data: gAccount } = await supabase
        .from("accounts")
        .select("id, account_number, account_type, total_savings, user_id")
        .eq("id", guarantorAccountId)
        .single();

      if (gAccount) {
        let gName = "Unknown";
        if (gAccount.account_type === "sub") {
          const { data: sp } = await supabase
            .from("sub_account_profiles")
            .select("full_name")
            .eq("account_id", guarantorAccountId)
            .single();
          gName = sp?.full_name ?? gAccount.account_number;
        } else {
          const { data: gp } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", gAccount.user_id)
            .single();
          gName = gp?.full_name ?? gAccount.account_number;
        }

        // Count active guarantees for this guarantor
        const { data: activeGuarantees } = await supabase
          .from("loans")
          .select("id")
          .eq("guarantor_account_id", guarantorAccountId)
          .in("status", ["pending", "approved", "disbursed", "active"])
          .gt("outstanding_balance", 0);

        guarantorInfo = {
          name: gName,
          account_number: gAccount.account_number,
          total_savings: Number(gAccount.total_savings),
          account_type: gAccount.account_type,
          activeGuaranteeCount: (activeGuarantees ?? []).length,
        };
      }
    }

    // ── 5. Build AI prompt ───────────────────────────────────────────────────
    const maxLoan = Number(account.total_savings) * 3;
    const interestTotal = loanAmount
      ? loanAmount * 0.02 * (repaymentMonths || 1)
      : 0;
    const totalRepayable = loanAmount ? loanAmount + interestTotal : 0;

    const systemPrompt = `You are a strict SACCO loan eligibility officer for KINONI SACCO (Uganda). 
Evaluate loan applications by checking ALL these rules:

ELIGIBILITY RULES:
1. Applicant must have savings > 0
2. Maximum loan = 3× applicant's total savings
3. Applicant must NOT have any existing active loan with outstanding balance > 0
4. Guarantor's total savings must be ≥ the loan amount being applied for
5. Guarantor must NOT currently be guaranteeing another active loan (max 1 active guarantee at a time)
6. Guarantor cannot be the same account as the applicant
7. Interest rate is 2% per month flat; total interest = principal × 2% × months
8. Repayment period must be between 1 and 12 months

Respond in this EXACT JSON format (no markdown, no extra text):
{
  "overall_eligible": true|false,
  "risk_level": "low"|"medium"|"high"|"critical",
  "summary": "One concise sentence verdict",
  "checks": [
    { "rule": "Short rule name", "passed": true|false, "detail": "Explanation with numbers" }
  ],
  "recommendation": "Actionable advice for the member in 1-2 sentences"
}`;

    const userPrompt = `Applicant: ${applicantName}
Account: ${account.account_number} (${account.account_type})
Total Savings: UGX ${Number(account.total_savings).toLocaleString()}
Current Balance: UGX ${Number(account.balance).toLocaleString()}
Has Active Loan: ${hasActiveLoan ? "YES — blocked" : "No"}
Active Loans: ${JSON.stringify(existingLoans ?? [])}
Max Eligible Loan: UGX ${maxLoan.toLocaleString()}

Requested Loan Amount: ${loanAmount ? "UGX " + loanAmount.toLocaleString() : "Not yet entered"}
Repayment Period: ${repaymentMonths || "Not selected"} month(s)
Total Interest: ${loanAmount ? "UGX " + interestTotal.toLocaleString() : "N/A"}
Total Repayable: ${loanAmount ? "UGX " + totalRepayable.toLocaleString() : "N/A"}

Guarantor Selected: ${guarantorInfo ? "Yes" : "No"}
${
  guarantorInfo
    ? `Guarantor Name: ${guarantorInfo.name}
Guarantor Account: ${guarantorInfo.account_number} (${guarantorInfo.account_type})
Guarantor Savings: UGX ${guarantorInfo.total_savings.toLocaleString()}
Guarantor Active Guarantees: ${guarantorInfo.activeGuaranteeCount}`
    : "No guarantor selected yet"
}`;

    // ── 6. Call Lovable AI Gateway ──────────────────────────────────────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
        }),
      },
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage credits exhausted. Please contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error ${aiResponse.status}: ${errText}`);
    }

    const aiJson = await aiResponse.json();
    const rawContent = aiJson.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try to extract JSON from markdown code blocks
      const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = match ? JSON.parse(match[1]) : { error: "Could not parse AI response" };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-loan-eligibility error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
