import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const changes = [
  {
    category: "UI / Design System",
    date: "2026-03-09",
    items: [
      "Overhauled entire UI to a Fintech-grade design system (KINONI SACCO Design System)",
      "Replaced default fonts with DM Sans, Space Grotesk, and JetBrains Mono",
      "Adopted indigo-blue primary colour palette with semantic HSL design tokens",
      "Added fluid typography and fluid spacing variables (clamp-based responsive scale)",
      "Introduced fintech stat-card variants: primary, success, warning, destructive, info",
      "Added glass-morphism utility class (.glass-card) with backdrop blur",
      "Added fintech gradient card utilities (.gradient-card-primary, .gradient-card-success)",
      "Added card hover animation utility (.card-hover)",
      "Added animated gradient background utility (.animated-gradient) for hero sections",
      "Added sidebar nav active-item glow effect (.nav-item-active)",
      "Added fintech table styles (.fintech-table) with hover and uppercase headers",
      "Added status badge helpers: approved, pending, rejected, overdue, disbursed, paid",
      "Added tabular-nums display utility using JetBrains Mono for financial figures",
      "Implemented dark mode with full token overrides for all semantic colours",
      "Added layered shadow scale: shadow-2xs through shadow-2xl",
      "Added fintech gradient definitions: primary, success, warning, info, card",
      "Redesigned Card component with rounded-xl, smooth transitions, and responsive padding",
      "Redesigned Input component with responsive height and touch-manipulation support",
      "Added PasswordInput component with show/hide password toggle",
      "Added FinStatCard component with framer-motion entrance animations and variant styling",
      "Added EnhancedMobileNavCard component for mobile dashboard navigation tiles",
      "Mobile tap-target enforcement (min 36×36 px) on buttons, links, checkboxes, radios",
      "Mobile scroll optimisations: touch momentum scrolling and table overflow handling",
    ],
  },
  {
    category: "Branding",
    date: "2026-03-09",
    items: [
      'Replaced "Modern SACCO" with "KINONI SACCO" across all pages',
      'Updated Auth page titles to display "KINONI SACCO" on all authentication states (Login, Sign Up, Password Reset, Existing Session)',
      'Updated landing page (Index.tsx) hero heading to "KINONI SACCO"',
      "Added copyright footer to Auth page: © 2026 CYBERSTEM Ltd. All Rights Reserved.",
    ],
  },
  {
    category: "Loan Application & Guarantor Logic",
    date: "2026-03-09",
    items: [
      "Enhanced get_guarantor_candidates RPC to accept p_min_savings parameter and filter by minimum savings threshold",
      "Added NOT EXISTS clause to exclude members currently serving as active guarantors on a disbursed loan",
      "Updated LoanApplication component to re-fetch eligible guarantors dynamically when the applicant switches accounts",
      "Enforced guarantor eligibility rules at the database query level for improved security and consistency",
    ],
  },
  {
    category: "Dashboard & Layout",
    date: "2026-03-09",
    items: [
      "Implemented collapsible sidebar DashboardLayout with framer-motion animations",
      "Added role-based navigation: separate nav items for admin and member roles",
      "Added real-time data listeners (Supabase Realtime) to AdminDashboard and MemberDashboard",
      "Added EnhancedMobileNavCard navigation grid on mobile dashboard",
      "Added LoanCompletionChart and LoanRepaymentSchedule to MemberDashboard",
      "Added joint-account toggle in MemberDashboard to display combined sub-account totals",
      "DashboardHeader now handles PWA install prompt and conditional admin/member avatar dropdown",
    ],
  },
  {
    category: "Admin Features",
    date: "2026-03-09",
    items: [
      "Built TransactionsManagement with approve/reject/delete, receipt generation, and create-transaction dialogs",
      "Built LoansManagement with guarantor assignment, approval, rejection, disbursement, edit, and overdue-charge dialogs",
      "Built MembersManagement with member creation via create-member Edge Function",
      "Built WelfareManagement with weekly welfare deduction trigger",
      "Built ReportsGeneration supporting text, PDF, and Excel exports for member and group reports",
      "Built StatementsGeneration for individual member account statements",
      "Built AIReportInsights component with streaming AI analysis using Gemini",
      "Built FinancialIntegrityChecker comparing stored balances vs recalculated values",
      "Built AlertsReminders for admin to create and send reminders to members",
    ],
  },
  {
    category: "Member Features",
    date: "2026-03-09",
    items: [
      "Built AccountOverview with balance, savings, and loan summary cards",
      "Built TransactionHistory with search and filter",
      "Built LoanApplication with AI eligibility check via Edge Function",
      "Built GuarantorRequests with accept/decline actions",
      "Built SavingsTracker with weekly savings chart",
      "Built SubAccountsManager for managing sub/dependent accounts",
      "Built MemberStatement supporting text and PDF downloads with optional joint-account inclusion",
      "Built ProfileManagement for updating personal details",
      "Built RecordTransaction for submitting deposit/withdrawal requests",
      "Built MemberReminders for viewing notifications",
      "Built NotificationsPopover for unread reminder badges",
    ],
  },
  {
    category: "Backend / Edge Functions",
    date: "2026-03-09",
    items: [
      "Deployed create-member Edge Function to provision auth user and account",
      "Deployed generate-receipt Edge Function for PDF transaction receipts",
      "Deployed ai-loan-eligibility Edge Function using Gemini for advanced loan checks",
      "Deployed ai-report-analysis Edge Function for streaming AI financial insights",
      "Deployed verify-financial-integrity Edge Function for balance reconciliation",
      "Deployed apply-overdue-interest Edge Function for penalty charge automation",
      "Deployed loan-status-notification Edge Function for email alerts on loan status changes",
      "Deployed send-reminder-email Edge Function for member reminder emails",
      "Deployed weekly-welfare-deduction Edge Function for automated welfare deductions",
    ],
  },
  {
    category: "PDF & Report Generation",
    date: "2026-03-09",
    items: [
      "Built pdfGenerator.ts with generateMemberStatementPDF, generateGroupReportPDF, and generateTransactionReceiptPDF",
      "Built bankReportGenerator.ts with bank-grade PDF templates including header, footer, and analyst endorsement",
      "Added Excel (XLSX) export support for member and group reports using SheetJS",
      "Added text report export for both member and group reports",
    ],
  },
  {
    category: "Security & RLS",
    date: "2026-03-09",
    items: [
      "Implemented Row-Level Security (RLS) on all tables: accounts, transactions, loans, savings, welfare, reminders, profiles, sub_account_profiles",
      "Created has_role() security definer function to prevent recursive RLS checks",
      "Stored roles in a separate user_roles table (admin | member enum) to prevent privilege escalation",
      "Implemented user_owns_parent_account() function to validate sub-account ownership",
    ],
  },
];

const categoryColour: Record<string, string> = {
  "UI / Design System": "bg-primary/10 text-primary border-primary/20",
  "Branding": "bg-accent text-accent-foreground border-accent-foreground/10",
  "Loan Application & Guarantor Logic": "bg-warning/10 text-warning border-warning/20",
  "Dashboard & Layout": "bg-info/10 text-info border-info/20",
  "Admin Features": "bg-destructive/10 text-destructive border-destructive/20",
  "Member Features": "bg-success/10 text-success border-success/20",
  "Backend / Edge Functions": "bg-primary/10 text-primary border-primary/20",
  "PDF & Report Generation": "bg-warning/10 text-warning border-warning/20",
  "Security & RLS": "bg-destructive/10 text-destructive border-destructive/20",
};

const Changelog = () => {
  const navigate = useNavigate();

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = margin;

    const checkPage = (needed = 8) => {
      if (y + needed > pageH - 14) {
        doc.addPage();
        y = margin;
      }
    };

    // Header bar
    doc.setFillColor(59, 76, 249);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("KINONI SACCO", margin, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("System Enhancement Changelog", pageW - margin, 14, { align: "right" });

    y = 32;
    doc.setTextColor(30, 30, 60);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Changelog — All Enhancements", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 120);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, margin, y);
    y += 10;

    // Divider
    doc.setDrawColor(59, 76, 249);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    changes.forEach((section) => {
      checkPage(14);
      // Section heading background
      doc.setFillColor(240, 242, 255);
      doc.roundedRect(margin, y - 4, contentW, 10, 2, 2, "F");
      doc.setTextColor(59, 76, 249);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(section.category, margin + 3, y + 3);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 160);
      doc.text(section.date, pageW - margin - 2, y + 3, { align: "right" });
      y += 12;

      section.items.forEach((item) => {
        const lines = doc.splitTextToSize(`• ${item}`, contentW - 4);
        checkPage(lines.length * 5 + 2);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 60);
        doc.text(lines, margin + 3, y);
        y += lines.length * 5 + 1.5;
      });

      y += 6;
    });

    // Footer on every page
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(245, 246, 252);
      doc.rect(0, pageH - 12, pageW, 12, "F");
      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 160);
      doc.setFont("helvetica", "normal");
      doc.text("© 2026 CYBERSTEM Ltd. All Rights Reserved. | KINONI SACCO Platform", margin, pageH - 4);
      doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
    }

    doc.save("KINONI_SACCO_Changelog.pdf");
  };

  const totalItems = changes.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-foreground">System Changelog</h1>
              <p className="text-xs text-muted-foreground">KINONI SACCO · {totalItems} enhancements</p>
            </div>
          </div>
          <Button onClick={downloadPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {changes.map((section) => (
          <Card key={section.category}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${categoryColour[section.category] ?? "bg-muted text-muted-foreground border-border"}`}
                  >
                    {section.category}
                  </span>
                </CardTitle>
                <span className="text-xs text-muted-foreground">{section.date}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/80">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-8">
          © 2026 CYBERSTEM Ltd. All Rights Reserved.
        </p>
      </div>
    </div>
  );
};

export default Changelog;
