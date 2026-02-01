import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LoanStatusRequest {
  loanId: string;
  newStatus: string;
  memberName: string;
  memberEmail?: string;
  loanAmount: number;
  outstandingBalance: number;
  accountId: string;
}

const getStatusMessage = (status: string, memberName: string, loanAmount: number, outstandingBalance: number) => {
  const formattedAmount = `UGX ${loanAmount.toLocaleString()}`;
  const formattedBalance = `UGX ${outstandingBalance.toLocaleString()}`;
  
  switch (status) {
    case "approved":
      return {
        title: "Loan Application Approved",
        message: `Dear ${memberName}, your loan application of ${formattedAmount} has been approved. Please wait for disbursement.`,
      };
    case "disbursed":
    case "active":
      return {
        title: "Loan Disbursed Successfully",
        message: `Dear ${memberName}, your loan of ${formattedAmount} has been disbursed to your account. Total amount to repay: ${formattedBalance}.`,
      };
    case "completed":
      return {
        title: "Loan Fully Repaid - Congratulations!",
        message: `Dear ${memberName}, congratulations! Your loan of ${formattedAmount} has been fully repaid. Thank you for your timely payments.`,
      };
    case "rejected":
      return {
        title: "Loan Application Update",
        message: `Dear ${memberName}, we regret to inform you that your loan application of ${formattedAmount} could not be approved at this time. Please contact the office for more information.`,
      };
    default:
      return {
        title: "Loan Status Update",
        message: `Dear ${memberName}, your loan status has been updated to: ${status}.`,
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { loanId, newStatus, memberName, memberEmail, loanAmount, outstandingBalance, accountId }: LoanStatusRequest = await req.json();

    if (!loanId || !newStatus || !memberName || !accountId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing loan status notification: ${newStatus} for ${memberName}`);

    const { title, message } = getStatusMessage(newStatus, memberName, loanAmount, outstandingBalance);

    // Create in-app notification (reminder)
    const { error: reminderError } = await supabaseClient
      .from("reminders")
      .insert({
        account_id: accountId,
        reminder_type: "loan_status",
        title,
        message,
        is_read: false,
        is_email_sent: false,
      });

    if (reminderError) {
      console.error("Error creating reminder:", reminderError);
    }

    // Try to send email if RESEND_API_KEY is configured and email is provided
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (RESEND_API_KEY && memberEmail) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1a1a4e 0%, #2d2d7a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px; background-color: #f9f9f9; }
                .status-badge { display: inline-block; background-color: ${newStatus === 'completed' ? '#22c55e' : newStatus === 'approved' ? '#3b82f6' : newStatus === 'rejected' ? '#ef4444' : '#f59e0b'}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
                .amount { font-size: 24px; font-weight: bold; color: #1a1a4e; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #e5e5e5; border-radius: 0 0 10px 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>KINONI SACCO</h1>
                  <p>Loan Status Update</p>
                </div>
                <div class="content">
                  <p><span class="status-badge">${newStatus}</span></p>
                  <h2>${title}</h2>
                  <p>${message}</p>
                  <p class="amount">Loan Amount: UGX ${loanAmount.toLocaleString()}</p>
                  ${outstandingBalance > 0 ? `<p>Outstanding Balance: UGX ${outstandingBalance.toLocaleString()}</p>` : ''}
                  <p>If you have any questions, please contact our office.</p>
                  <p>Best regards,<br>KINONI SACCO Management</p>
                </div>
                <div class="footer">
                  <p>This is an automated message from KINONI SACCO Management System.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "KINONI SACCO <onboarding@resend.dev>",
            to: [memberEmail],
            subject: `[KINONI SACCO] ${title}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
          // Update the reminder to mark email as sent
          await supabaseClient
            .from("reminders")
            .update({ is_email_sent: true })
            .eq("account_id", accountId)
            .eq("title", title)
            .order("created_at", { ascending: false })
            .limit(1);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    }

    console.log(`Notification created, email sent: ${emailSent}`);

    return new Response(
      JSON.stringify({ success: true, emailSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in loan-status-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
