import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AUTHENTICATION CHECK
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Allow service role key (used by cron jobs) to bypass user auth check
    const isServiceRoleCall = token === supabaseServiceKey;

    if (!isServiceRoleCall) {
      // Normal user auth flow — verify admin role
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.error("Invalid token:", authError?.message);
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: role, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !role) {
        console.error(`User ${user.id} attempted overdue interest without admin role`);
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Overdue interest check initiated by admin ${user.id} (${user.email})`);
    } else {
      console.log("Overdue interest check initiated by scheduled cron job (service role)");
    }

    const today = new Date();
    // Use UTC date string YYYY-MM-DD for idempotency key (one accrual per day)
    const todayKey = today.toISOString().split('T')[0];

    // Daily accrual rate: 2% per month / 30 days = 0.0667% per day
    const MONTHLY_PENALTY_RATE = 0.02;
    const DAILY_PENALTY_RATE = MONTHLY_PENALTY_RATE / 30;

    // Get all active loans with outstanding balance that have been disbursed
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("id, account_id, amount, outstanding_balance, repayment_months, disbursed_at, interest_rate")
      .in("status", ["disbursed", "active"])
      .gt("outstanding_balance", 0)
      .not("disbursed_at", "is", null);

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      return new Response(
        JSON.stringify({ error: loansError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const appliedLoans: { loanId: string; accountId: string; dailyCharge: number }[] = [];

    for (const loan of loans || []) {
      const disbursedDate = new Date(loan.disbursed_at);
      const expectedEndDate = new Date(disbursedDate);
      expectedEndDate.setMonth(expectedEndDate.getMonth() + (loan.repayment_months || 1));

      // Only apply to overdue loans (past their repayment end date)
      if (today <= expectedEndDate) {
        skippedCount++;
        continue;
      }

      // ---- IDEMPOTENCY: check if we already applied overdue interest TODAY for this loan ----
      const { data: existingToday } = await supabase
        .from("transactions")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("transaction_type", "overdue_interest")
        .gte("created_at", `${todayKey}T00:00:00.000Z`)
        .lt("created_at", `${todayKey}T23:59:59.999Z`)
        .limit(1);

      if (existingToday && existingToday.length > 0) {
        console.log(`Loan ${loan.id} already has overdue interest for ${todayKey} — skipping`);
        skippedCount++;
        continue;
      }

      // Daily charge = principal * 0.02 / 30
      const dailyCharge = Math.round((loan.amount * DAILY_PENALTY_RATE) * 100) / 100;

      if (dailyCharge <= 0) {
        skippedCount++;
        continue;
      }

      const newOutstandingBalance = Math.round((loan.outstanding_balance + dailyCharge) * 100) / 100;

      // Days overdue (for informative description)
      const daysOverdue = Math.floor((today.getTime() - expectedEndDate.getTime()) / (1000 * 60 * 60 * 24));

      // Update loan outstanding balance
      const { error: updateError } = await supabase
        .from("loans")
        .update({ outstanding_balance: newOutstandingBalance })
        .eq("id", loan.id);

      if (updateError) {
        console.error(`Error updating loan ${loan.id}:`, updateError);
        continue;
      }

      // Record daily overdue interest as a transaction for full audit trail
      // transaction_type = "overdue_interest" — distinct from disbursements/repayments
      // tnx_id is left null so the DB trigger auto-generates a valid 9-digit ID
      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          account_id: loan.account_id,
          transaction_type: "overdue_interest",
          amount: dailyCharge,
          balance_after: 0, // Does not directly affect account cash balance
          description: `Daily overdue penalty (2%/30) - Day ${daysOverdue} overdue [${todayKey}]`,
          status: "approved",
          approved_at: new Date().toISOString(),
          loan_id: loan.id,
          tnx_id: null, // Let DB trigger generate a valid 9-digit tnx_id
        } as any);

      if (txError) {
        console.error(`Error recording overdue interest transaction for loan ${loan.id}:`, txError);
        // Roll back loan balance update
        await supabase
          .from("loans")
          .update({ outstanding_balance: loan.outstanding_balance })
          .eq("id", loan.id);
        continue;
      }

      appliedLoans.push({ loanId: loan.id, accountId: loan.account_id, dailyCharge });
      console.log(`Loan ${loan.id}: applied daily overdue charge of UGX ${dailyCharge.toLocaleString()} (Day ${daysOverdue} overdue)`);
      updatedCount++;
    }

    const totalCharged = appliedLoans.reduce((sum, l) => sum + l.dailyCharge, 0);
    console.log(`Overdue interest complete: ${updatedCount} loans updated, ${skippedCount} skipped. Total charged: UGX ${totalCharged.toLocaleString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily overdue interest applied to ${updatedCount} loans, ${skippedCount} skipped`,
        updated: updatedCount,
        skipped: skippedCount,
        total_charged: totalCharged,
        date: todayKey,
        loans_affected: appliedLoans,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in apply-overdue-interest:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
