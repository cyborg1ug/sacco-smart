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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Invalid token:", authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ADMIN ROLE CHECK
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

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Get all active/disbursed loans with outstanding balance
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("id, account_id, amount, outstanding_balance, repayment_months, disbursed_at, interest_rate")
      .in("status", ["disbursed", "active"])
      .gt("outstanding_balance", 0);

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      return new Response(
        JSON.stringify({ error: loansError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const loan of loans || []) {
      if (!loan.disbursed_at) {
        skippedCount++;
        continue;
      }

      const disbursedDate = new Date(loan.disbursed_at);
      const expectedEndDate = new Date(disbursedDate);
      expectedEndDate.setMonth(expectedEndDate.getMonth() + (loan.repayment_months || 1));

      // Check if loan is overdue (past repayment period)
      if (today <= expectedEndDate) {
        skippedCount++;
        continue;
      }

      // Calculate months overdue (rounded up)
      const monthsOverdue = Math.ceil(
        (today.getTime() - expectedEndDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      if (monthsOverdue <= 0) {
        skippedCount++;
        continue;
      }

      // Check if we already applied overdue interest this month
      // We track this by checking for a transaction with specific description
      const monthYearKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const { data: existingInterest } = await supabase
        .from("transactions")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("transaction_type", "loan_disbursement")
        .ilike("description", `%overdue interest%${monthYearKey}%`)
        .limit(1);

      if (existingInterest && existingInterest.length > 0) {
        console.log(`Loan ${loan.id} already has overdue interest for ${monthYearKey}`);
        skippedCount++;
        continue;
      }

      // Calculate 2% of original loan amount for overdue interest
      const overdueInterest = loan.amount * 0.02;
      const newOutstandingBalance = loan.outstanding_balance + overdueInterest;

      // Update loan outstanding balance
      const { error: updateError } = await supabase
        .from("loans")
        .update({ 
          outstanding_balance: newOutstandingBalance,
        })
        .eq("id", loan.id);

      if (updateError) {
        console.error(`Error updating loan ${loan.id}:`, updateError);
        continue;
      }

      // Create a record for tracking (not a real transaction, just for logging)
      await supabase
        .from("transactions")
        .insert({
          account_id: loan.account_id,
          transaction_type: "loan_disbursement",
          amount: overdueInterest,
          balance_after: 0, // Not affecting account balance
          description: `Overdue interest (2%) - ${monthYearKey}`,
          status: "approved",
          approved_at: new Date().toISOString(),
          loan_id: loan.id,
        } as any);

      console.log(`Applied UGX ${overdueInterest.toLocaleString()} overdue interest to loan ${loan.id}`);
      updatedCount++;
    }

    console.log(`Overdue interest complete: ${updatedCount} loans updated, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Applied overdue interest to ${updatedCount} loans, ${skippedCount} skipped`,
        updated: updatedCount,
        skipped: skippedCount,
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
