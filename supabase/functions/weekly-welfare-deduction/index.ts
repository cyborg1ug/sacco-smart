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
      console.error(`User ${user.id} attempted welfare deduction without admin role`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Welfare deduction initiated by admin ${user.id} (${user.email})`);

    const weeklyAmount = 2000; // UGX 2,000 per week
    const today = new Date();
    
    // Calculate week start (Sunday) for idempotency check
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // IDEMPOTENCY CHECK - prevent duplicate deductions in same week
    const { data: existing } = await supabase
      .from("welfare")
      .select("id")
      .eq("week_date", weekStartStr)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Welfare deduction already performed for week starting ${weekStartStr}`);
      return new Response(
        JSON.stringify({ error: 'Welfare deduction already performed this week', week: weekStartStr }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("accounts")
      .select("id, balance, total_savings");

    if (accountsError) {
      console.error("Error fetching accounts:", accountsError);
      return new Response(
        JSON.stringify({ error: accountsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing welfare deductions for ${accounts.length} accounts`);

    let successCount = 0;
    let errorCount = 0;

    for (const account of accounts) {
      // Insert welfare entry with week start date for idempotency
      const { error: welfareError } = await supabase
        .from("welfare")
        .insert({
          account_id: account.id,
          amount: weeklyAmount,
          week_date: weekStartStr,
          description: "Weekly welfare fee - Auto deducted",
        });

      if (welfareError) {
        console.error(`Error inserting welfare for account ${account.id}:`, welfareError);
        errorCount++;
        continue;
      }

      // Deduct from account balance and total_savings
      const newBalance = Math.max(0, account.balance - weeklyAmount);
      const newTotalSavings = Math.max(0, account.total_savings - weeklyAmount);

      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          balance: newBalance,
          total_savings: newTotalSavings,
        })
        .eq("id", account.id);

      if (updateError) {
        console.error(`Error updating account ${account.id}:`, updateError);
        errorCount++;
        continue;
      }

      // Create transaction record
      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          account_id: account.id,
          transaction_type: "withdrawal",
          amount: weeklyAmount,
          description: "Weekly welfare fee deduction",
          balance_after: newBalance,
          status: "approved",
          approved_at: new Date().toISOString(),
        });

      if (txError) {
        console.error(`Error creating transaction for account ${account.id}:`, txError);
      }

      successCount++;
    }

    console.log(`Welfare deduction complete by ${user.email}: ${successCount} successful, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${successCount} accounts, ${errorCount} errors`,
        processed: successCount,
        errors: errorCount,
        week: weekStartStr,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in weekly-welfare-deduction:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});