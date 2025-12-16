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

    const weeklyAmount = 2000; // UGX 2,000 per week
    const today = new Date();
    const weekDate = today.toISOString().split('T')[0];

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
      // Insert welfare entry
      const { error: welfareError } = await supabase
        .from("welfare")
        .insert({
          account_id: account.id,
          amount: weeklyAmount,
          week_date: weekDate,
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

    console.log(`Welfare deduction complete: ${successCount} successful, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${successCount} accounts, ${errorCount} errors`,
        processed: successCount,
        errors: errorCount,
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