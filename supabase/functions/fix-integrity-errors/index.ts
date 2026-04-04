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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin
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
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { fixes } = await req.json() as {
      fixes: Array<{
        type: "account_balance" | "account_savings" | "loan_outstanding";
        id: string;
        correct_value: number;
      }>;
    };

    if (!fixes || !Array.isArray(fixes) || fixes.length === 0) {
      return new Response(JSON.stringify({ error: "No fixes provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; type: string; success: boolean; error?: string }> = [];

    for (const fix of fixes) {
      try {
        if (fix.type === "account_balance") {
          const { error } = await admin.from("accounts")
            .update({ balance: fix.correct_value, updated_at: new Date().toISOString() })
            .eq("id", fix.id);
          results.push({ id: fix.id, type: fix.type, success: !error, error: error?.message });
        } else if (fix.type === "account_savings") {
          const { error } = await admin.from("accounts")
            .update({ total_savings: fix.correct_value, updated_at: new Date().toISOString() })
            .eq("id", fix.id);
          results.push({ id: fix.id, type: fix.type, success: !error, error: error?.message });
        } else if (fix.type === "loan_outstanding") {
          const updateData: any = { outstanding_balance: fix.correct_value, updated_at: new Date().toISOString() };
          if (fix.correct_value <= 0) updateData.status = "fully_paid";
          const { error } = await admin.from("loans").update(updateData).eq("id", fix.id);
          results.push({ id: fix.id, type: fix.type, success: !error, error: error?.message });
        }
      } catch (e) {
        results.push({ id: fix.id, type: fix.type, success: false, error: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return new Response(JSON.stringify({
      success: true,
      message: `Fixed ${successCount} of ${fixes.length} discrepancies`,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Fix integrity error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
