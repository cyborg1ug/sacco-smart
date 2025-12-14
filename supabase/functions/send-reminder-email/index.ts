import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderEmailRequest {
  to: string;
  name: string;
  title: string;
  message: string;
  reminderType: string;
  dueDate?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, name, title, message, reminderType, dueDate }: ReminderEmailRequest = await req.json();

    console.log(`Preparing to send reminder email to ${to}`);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          error: "Email service not configured. Please configure RESEND_API_KEY." 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const reminderTypeLabel = reminderType.replace("_", " ").toUpperCase();
    const dueDateText = dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #006400; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .badge { display: inline-block; background-color: #e0e0e0; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-bottom: 10px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>KINONI SACCO</h1>
            </div>
            <div class="content">
              <span class="badge">${reminderTypeLabel}</span>
              <h2>${title}</h2>
              <p>Dear ${name},</p>
              <p>${message}</p>
              ${dueDateText}
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
        to: [to],
        subject: `[KINONI SACCO] ${title}`,
        html: emailHtml,
      }),
    });

    const responseData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", responseData);
      return new Response(
        JSON.stringify({ error: responseData.message || "Failed to send email" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", responseData);

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-reminder-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
