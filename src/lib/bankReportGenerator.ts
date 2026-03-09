import { format, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ─── Colour palette ────────────────────────────────────────────────────────
const C = {
  navy:    [13, 37, 80]   as [number, number, number],
  blue:    [30, 86, 160]  as [number, number, number],
  gold:    [180, 140, 40] as [number, number, number],
  white:   [255, 255, 255] as [number, number, number],
  light:   [245, 247, 252] as [number, number, number],
  border:  [210, 218, 235] as [number, number, number],
  text:    [30, 40, 60]   as [number, number, number],
  muted:   [110, 120, 145] as [number, number, number],
  green:   [22, 140, 82]  as [number, number, number],
  red:     [200, 40, 40]  as [number, number, number],
  orange:  [200, 100, 30] as [number, number, number],
};

const ugx = (n: number) => `UGX ${Number(n).toLocaleString("en-UG", { minimumFractionDigits: 2 })}`;
const pct = (n: number) => `${Number(n).toFixed(2)}%`;

function addBankHeader(doc: jsPDF, title: string, subtitle: string, refNo: string) {
  const W = doc.internal.pageSize.getWidth();

  // Navy header band
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 32, "F");

  // Gold accent line
  doc.setFillColor(...C.gold);
  doc.rect(0, 32, W, 2, "F");

  // Institution name
  doc.setTextColor(...C.white);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("KINONI SACCO", 14, 13);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Savings & Credit Cooperative Organisation", 14, 20);
  doc.text("Managed by CYBERSTEM Ltd. | cyberstemug@gmail.com", 14, 26);

  // Reference on right
  doc.setFontSize(7);
  doc.text(`Ref: ${refNo}`, W - 14, 20, { align: "right" });
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, W - 14, 26, { align: "right" });

  // Document title
  doc.setFillColor(...C.light);
  doc.rect(0, 34, W, 16, "F");
  doc.setTextColor(...C.navy);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 44);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(subtitle, 14, 50);

  return 58; // Y cursor after header
}

const ANALYST = {
  name: "Vincent Cyborgs",
  title: "Financial Analyst",
  institution: "KINONI SACCO / CYBERSTEM Ltd.",
};

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.navy);
    doc.rect(0, H - 12, W, 12, "F");
    doc.setFillColor(...C.gold);
    doc.rect(0, H - 12, W, 1.5, "F");
    doc.setTextColor(...C.white);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("KINONI SACCO — CONFIDENTIAL FINANCIAL DOCUMENT", 14, H - 4.5);
    doc.text(`Page ${i} of ${pages}`, W - 14, H - 4.5, { align: "right" });
    doc.setTextColor(...C.muted);
    doc.setFontSize(6.5);
    doc.text("This document is computer-generated and is valid without signature. For queries: cyberstemug@gmail.com", W / 2, H - 1.5, { align: "center" });
  }
}

function addAnalystEndorsement(doc: jsPDF, y: number): number {
  const W = doc.internal.pageSize.getWidth();
  if (y > 255) { doc.addPage(); y = 20; }
  y += 6;

  // Endorsement box
  doc.setFillColor(...C.light);
  doc.rect(14, y, W - 28, 24, "F");
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.8);
  doc.rect(14, y, W - 28, 24, "S");
  doc.setLineWidth(0.2);

  // Left — title
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.navy);
  doc.text("PREPARED & ENDORSED BY", 18, y + 6);

  // Analyst details
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.text);
  doc.text(ANALYST.name, 18, y + 13);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text(`${ANALYST.title} | ${ANALYST.institution}`, 18, y + 19);

  // Right — signature line
  doc.setDrawColor(...C.navy);
  doc.setLineWidth(0.5);
  doc.line(W - 80, y + 18, W - 18, y + 18);
  doc.setLineWidth(0.2);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...C.muted);
  doc.text("Authorised Signature", W - 49, y + 22, { align: "center" });

  // Date stamp
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${format(new Date(), "dd MMMM yyyy")}`, W - 18, y + 6, { align: "right" });

  return y + 28;
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.navy);
  doc.rect(14, y, W - 28, 7, "F");
  doc.setTextColor(...C.white);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 18, y + 4.8);
  return y + 10;
}

function kv(doc: jsPDF, y: number, label: string, value: string, valueColor?: [number, number, number]): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.light);
  doc.rect(14, y, W - 28, 6, "F");
  doc.setDrawColor(...C.border);
  doc.rect(14, y, W - 28, 6, "S");
  doc.setTextColor(...C.muted);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(label, 18, y + 4.2);
  doc.setTextColor(...(valueColor || C.text));
  doc.setFont("helvetica", "bold");
  doc.text(value, W - 18, y + 4.2, { align: "right" });
  return y + 6;
}

// ════════════════════════════════════════════════════════════════════════════
// BANK-FORMAT MEMBER STATEMENT PDF
// ════════════════════════════════════════════════════════════════════════════
export function generateBankMemberPDF(params: {
  memberName: string;
  email: string;
  phoneNumber?: string;
  occupation?: string;
  accountNumber: string;
  balance: number;
  totalSavings: number;
  period: { start: Date; end: Date };
  allTxns: any[];
  periodTxns: any[];
  loans: any[];
  aiAnalysis?: string;
}) {
  const { memberName, email, phoneNumber, occupation, accountNumber, balance, totalSavings,
    period, allTxns, periodTxns, loans, aiAnalysis } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const refNo = `KS-MBR-${accountNumber}-${format(new Date(), "yyyyMMddHHmm")}`;

  let y = addBankHeader(
    doc,
    "MEMBER ACCOUNT STATEMENT",
    `${format(period.start, "dd MMM yyyy")} to ${format(period.end, "dd MMM yyyy")} | ${memberName}`,
    refNo
  );

  // ── Member Details ─────────────────────────────────────────────────────
  y = sectionTitle(doc, y, "1. Account Holder Details");
  y = kv(doc, y, "Full Name", memberName);
  y = kv(doc, y, "Account Number", accountNumber);
  y = kv(doc, y, "Email Address", email);
  y = kv(doc, y, "Phone Number", phoneNumber || "Not provided");
  y = kv(doc, y, "Occupation", occupation || "Not provided");
  y = kv(doc, y, "Statement Period", `${format(period.start, "dd MMM yyyy")} — ${format(period.end, "dd MMM yyyy")}`);
  y += 5;

  // ── Current Balances ───────────────────────────────────────────────────
  y = sectionTitle(doc, y, "2. Current Account Balances");
  y = kv(doc, y, "Available Account Balance", ugx(balance), C.green);
  y = kv(doc, y, "Total Accumulated Savings", ugx(totalSavings), C.blue);
  y += 5;

  // ── All-time Summary ───────────────────────────────────────────────────
  const sum = (arr: any[], type: string) =>
    (arr || []).filter(t => t.transaction_type === type && t.status === "approved")
      .reduce((s, t) => s + Number(t.amount), 0);

  const aDep  = sum(allTxns, "deposit");
  const aWit  = sum(allTxns, "withdrawal");
  const aRep  = sum(allTxns, "loan_repayment");
  const aDisb = sum(allTxns, "loan_disbursement");
  const aInt  = sum(allTxns, "interest_received");

  y = sectionTitle(doc, y, "3. All-Time Financial Summary");
  y = kv(doc, y, "Total Deposits Received", ugx(aDep), C.green);
  y = kv(doc, y, "Total Withdrawals Made", ugx(aWit), C.orange);
  y = kv(doc, y, "Net Deposit Position", ugx(aDep - aWit), aDep >= aWit ? C.green : C.red);
  y = kv(doc, y, "Total Loan Disbursements", ugx(aDisb), C.blue);
  y = kv(doc, y, "Total Loan Repayments", ugx(aRep));
  y = kv(doc, y, "Total Interest Paid", ugx(aInt), C.orange);
  y += 5;

  // ── Loan Schedule ─────────────────────────────────────────────────────
  const activeLoans = (loans || []).filter(l => ["disbursed", "active"].includes(l.status) && l.outstanding_balance > 0);
  if (activeLoans.length > 0) {
    y = sectionTitle(doc, y, "4. Active Loan Schedule");
    activeLoans.forEach((l, i) => {
      const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "dd MMM yyyy") : "N/A";
      const dueDate = l.disbursed_at && l.repayment_months
        ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "dd MMM yyyy")
        : "N/A";
      const daysOverdue = (() => {
        if (!l.disbursed_at || !l.repayment_months) return 0;
        const due = new Date(l.disbursed_at);
        due.setMonth(due.getMonth() + l.repayment_months);
        return new Date() > due ? differenceInDays(new Date(), due) : 0;
      })();
      const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);

      if (y > 240) { doc.addPage(); y = 20; }
      y = kv(doc, y, `Loan ${i + 1} — Principal`, ugx(l.amount));
      y = kv(doc, y, "Interest Rate", `${l.interest_rate}% per month × ${l.repayment_months} months`);
      y = kv(doc, y, "Total Interest Charged", ugx(totalInterest), C.orange);
      y = kv(doc, y, "Total Amount Payable", ugx(l.total_amount));
      y = kv(doc, y, "Outstanding Balance", ugx(l.outstanding_balance), daysOverdue > 0 ? C.red : C.text);
      y = kv(doc, y, "Disbursement Date", disbDate);
      y = kv(doc, y, "Due Date", dueDate);
      y = kv(doc, y, "Loan Status", daysOverdue > 0 ? `⚠ OVERDUE — ${daysOverdue} day(s)` : l.status.toUpperCase(), daysOverdue > 0 ? C.red : C.green);
      y += 3;
    });
    y += 2;
  }

  // ── Transaction History ───────────────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, y, "5. Detailed Transaction History");
  y += 2;

  const txnRows = (allTxns || []).slice(0, 200).map(t => [
    format(new Date(t.created_at), "dd MMM yyyy"),
    t.tnx_id || "",
    t.transaction_type.replace(/_/g, " ").toUpperCase(),
    ugx(t.amount),
    ugx(t.balance_after || 0),
    (t.status || "").toUpperCase(),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date", "TXN ID", "Type", "Amount", "Balance After", "Status"]],
    body: txnRows,
    theme: "grid",
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7, fontStyle: "bold", cellPadding: 2 },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.5, textColor: C.text },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 38 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 28 },
      5: { cellWidth: 18 },
    },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      const val = String(data.cell.raw || "");
      if (val === "APPROVED") data.cell.styles.textColor = C.green;
      if (val === "PENDING")  data.cell.styles.textColor = C.orange;
      if (val === "REJECTED") data.cell.styles.textColor = C.red;
    },
  });

  // ── AI Analysis page ─────────────────────────────────────────────────
  if (aiAnalysis) {
    doc.addPage();
    let ay = addBankHeader(doc, "AI FINANCIAL ANALYSIS", `Automated analysis for ${memberName}`, refNo);
    ay = sectionTitle(doc, ay, "AI-Generated Financial Assessment");
    ay += 3;

    // Render AI text with line wrapping
    doc.setTextColor(...C.text);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(aiAnalysis, W - 28);
    lines.forEach((line: string) => {
      if (ay > 270) { doc.addPage(); ay = 20; }
      // Section headers in bold navy
      if (/^\d+\.\s+[A-Z\s&']+$/.test(line.trim()) || line.trim().endsWith(":") || line.startsWith("===")) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.navy);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.text);
      }
      doc.text(line, 14, ay);
      ay += 4.5;
    });

    // AI disclaimer
    doc.setFillColor(...C.light);
    const boxY = Math.min(ay + 5, 265);
    doc.rect(14, boxY, W - 28, 12, "F");
    doc.setDrawColor(...C.border);
    doc.rect(14, boxY, W - 28, 12, "S");
    doc.setTextColor(...C.muted);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("AI DISCLAIMER: This analysis is generated by AI (Google Gemini via Lovable AI Gateway) based on available SACCO data.", 18, boxY + 4.5);
    doc.text("It is for informational purposes only and does not constitute financial advice. Data verified against KINONI SACCO records.", 18, boxY + 9);
  }

  // ── Analyst Endorsement ───────────────────────────────────────────────
  if (y > 255) { doc.addPage(); y = 20; }
  addAnalystEndorsement(doc, (doc as any).lastAutoTable?.finalY ?? y);

  addFooter(doc);
  doc.save(`KINONI_SACCO_Statement_${accountNumber}_${format(new Date(), "yyyyMMdd")}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════════
// BANK-FORMAT GROUP REPORT PDF
// ════════════════════════════════════════════════════════════════════════════
export function generateBankGroupPDF(params: {
  period: { start: Date; end: Date };
  totalMembers: number;
  mainAccounts: number;
  subAccounts: number;
  totalBalance: number;
  totalSavings: number;
  allTimeDeposits: number;
  allTimeWithdrawals: number;
  allTimeDisbursements: number;
  allTimeRepayments: number;
  allTimeInterest: number;
  periodDeposits: number;
  periodWithdrawals: number;
  periodDisbursements: number;
  periodRepayments: number;
  periodInterest: number;
  activeLoans: number;
  totalOutstanding: number;
  overdueLoans: number;
  totalOverdueBalance: number;
  totalOverduePenalty: number;
  pendingLoans: number;
  completedLoans: number;
  members: any[];
  activeLoansData: any[];
  aiAnalysis?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const refNo = `KS-GRP-${format(new Date(), "yyyyMMddHHmm")}`;

  let y = addBankHeader(
    doc,
    "SACCO COMPREHENSIVE GROUP FINANCIAL REPORT",
    `Period: ${format(params.period.start, "dd MMM yyyy")} to ${format(params.period.end, "dd MMM yyyy")}`,
    refNo
  );

  // ── Summary grid ─────────────────────────────────────────────────────
  const loanToSavings = params.totalSavings > 0 ? (params.totalOutstanding / params.totalSavings) * 100 : 0;
  const overdueRate   = params.activeLoans > 0 ? (params.overdueLoans / params.activeLoans) * 100 : 0;
  const recoveryRate  = params.allTimeDisbursements > 0 ? (params.allTimeRepayments / params.allTimeDisbursements) * 100 : 0;
  const yieldRate     = params.allTimeDisbursements > 0 ? (params.allTimeInterest / params.allTimeDisbursements) * 100 : 0;

  y = sectionTitle(doc, y, "1. Organisation Overview");
  const half = (W - 28) / 2;

  // Left column
  let lx = 14, rx = 14 + half + 2;
  const colY = y;
  [(["Total Member Profiles", String(params.totalMembers)]),
   (["Main Accounts", String(params.mainAccounts)]),
   (["Sub-Accounts", String(params.subAccounts)]),
   (["Combined Balance", ugx(params.totalBalance)]),
   (["Combined Savings", ugx(params.totalSavings)]),
  ].forEach(([label, val]) => {
    doc.setFillColor(...C.light);
    doc.rect(lx, y, half, 6, "F");
    doc.setDrawColor(...C.border);
    doc.rect(lx, y, half, 6, "S");
    doc.setTextColor(...C.muted); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(label, lx + 4, y + 4.2);
    doc.setTextColor(...C.navy); doc.setFont("helvetica", "bold");
    doc.text(val, lx + half - 4, y + 4.2, { align: "right" });
    y += 6;
  });

  y = colY;
  [(["Loan-to-Savings Ratio", pct(loanToSavings)]),
   (["Overdue Rate", pct(overdueRate)]),
   (["Loan Recovery Rate", pct(recoveryRate)]),
   (["Interest Yield", pct(yieldRate)]),
   (["Pending Loan Approvals", String(params.pendingLoans)]),
  ].forEach(([label, val]) => {
    doc.setFillColor(...C.light);
    doc.rect(rx, y, half, 6, "F");
    doc.setDrawColor(...C.border);
    doc.rect(rx, y, half, 6, "S");
    doc.setTextColor(...C.muted); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(label, rx + 4, y + 4.2);
    doc.setTextColor(...C.navy); doc.setFont("helvetica", "bold");
    doc.text(val, rx + half - 4, y + 4.2, { align: "right" });
    y += 6;
  });
  y = colY + 30 + 5;

  // ── Financial Totals ─────────────────────────────────────────────────
  y = sectionTitle(doc, y, "2. Financial Performance — All-Time vs Period");
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Category", "All-Time Total", "Period Total", "Movement"]],
    body: [
      ["Total Deposits", ugx(params.allTimeDeposits), ugx(params.periodDeposits), params.periodDeposits > 0 ? "▲" : "—"],
      ["Total Withdrawals", ugx(params.allTimeWithdrawals), ugx(params.periodWithdrawals), ""],
      ["Net Deposits", ugx(params.allTimeDeposits - params.allTimeWithdrawals), ugx(params.periodDeposits - params.periodWithdrawals), ""],
      ["Loan Disbursements", ugx(params.allTimeDisbursements), ugx(params.periodDisbursements), ""],
      ["Loan Repayments", ugx(params.allTimeRepayments), ugx(params.periodRepayments), ""],
      ["Interest Income", ugx(params.allTimeInterest), ugx(params.periodInterest), params.periodInterest > 0 ? "▲" : "—"],
    ],
    theme: "grid",
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8, fontStyle: "bold", cellPadding: 2 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: C.text },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "center", cellWidth: 20 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Loan Portfolio ─────────────────────────────────────────────────
  y = sectionTitle(doc, y, "3. Loan Portfolio Summary");
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Loan Status", "Count", "Outstanding Balance", "Notes"]],
    body: [
      ["Active / Disbursed", String(params.activeLoans), ugx(params.totalOutstanding), "Currently running"],
      ["Overdue", String(params.overdueLoans), ugx(params.totalOverdueBalance), `Penalties: ${ugx(params.totalOverduePenalty)}`],
      ["Completed / Fully Paid", String(params.completedLoans), ugx(0), "Closed"],
      ["Pending Approval", String(params.pendingLoans), "—", "Awaiting review"],
    ],
    theme: "grid",
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, textColor: C.text },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.row.index === 1 && data.section === "body") {
        data.cell.styles.textColor = C.red;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Member Balances ───────────────────────────────────────────────────
  if (y > 160) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, y, "4. Individual Member Account Balances");
  y += 2;

  const memberRows = params.members.map(m => [
    m.name,
    m.accountNumber,
    m.accountType === "sub" ? "Sub" : "Main",
    ugx(m.balance),
    ugx(m.savings),
    m.activeLoans > 0 ? ugx(m.outstandingBalance) : "—",
    m.isOverdue ? `⚠ ${m.daysOverdue}d overdue` : (m.activeLoans > 0 ? "Active" : "None"),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Member Name", "Account No.", "Type", "Balance", "Savings", "Loan Outstanding", "Loan Status"]],
    body: memberRows,
    theme: "grid",
    headStyles: { fillColor: C.blue, textColor: C.white, fontSize: 7, fontStyle: "bold", cellPadding: 2 },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.5, textColor: C.text },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 6) {
        const val = String(data.cell.raw || "");
        if (val.includes("overdue")) data.cell.styles.textColor = C.red;
        else if (val === "Active") data.cell.styles.textColor = C.green;
      }
    },
  });

  // ── AI Analysis page ─────────────────────────────────────────────────
  if (params.aiAnalysis) {
    doc.addPage();
    let ay = addBankHeader(doc, "AI FINANCIAL AUDIT REPORT", "Automated SACCO-wide analysis", refNo);
    ay = sectionTitle(doc, ay, "AI-Generated Group Financial Assessment");
    ay += 3;

    doc.setTextColor(...C.text);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(params.aiAnalysis, W - 28);
    lines.forEach((line: string) => {
      if (ay > 185) { doc.addPage(); ay = 20; }
      if (/^\d+\.\s+[A-Z\s&']+$/.test(line.trim()) || line.includes("═") || line.includes("─")) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.navy);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.text);
      }
      doc.text(line, 14, ay);
      ay += 4.5;
    });

    const boxY = Math.min(ay + 4, 185);
    doc.setFillColor(...C.light);
    doc.rect(14, boxY, W - 28, 12, "F");
    doc.setDrawColor(...C.border);
    doc.rect(14, boxY, W - 28, 12, "S");
    doc.setTextColor(...C.muted);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("AI DISCLAIMER: Analysis generated by Google Gemini via Lovable AI Gateway based on KINONI SACCO transaction data.", 18, boxY + 4.5);
    doc.text("For informational and audit purposes only. Not financial advice. Report Reference: " + refNo, 18, boxY + 9);
  }

  // ── Analyst Endorsement ───────────────────────────────────────────────
  addAnalystEndorsement(doc, (doc as any).lastAutoTable?.finalY ?? y);

  addFooter(doc);
  doc.save(`KINONI_SACCO_Group_Report_${format(new Date(), "yyyyMMdd")}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════════
// BANK-FORMAT TEXT REPORT
// ════════════════════════════════════════════════════════════════════════════
export function generateBankTextReport(params: {
  type: "member" | "group";
  title: string;
  sections: { heading: string; rows: [string, string][] }[];
  aiAnalysis?: string;
  refNo: string;
  period: string;
}): string {
  const W = 80;
  const line  = "═".repeat(W);
  const dline = "─".repeat(W);
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  const rpad = (s: string, n: number) => s.padStart(n).slice(-n);

  let r = "";
  r += `${line}\n`;
  r += `${"KINONI SACCO".padStart(46)}\n`;
  r += `${"Savings & Credit Cooperative Organisation".padStart(50)}\n`;
  r += `${"Managed by CYBERSTEM Ltd. | cyberstemug@gmail.com".padStart(54)}\n`;
  r += `${line}\n`;
  r += `${params.title.toUpperCase().padStart((W + params.title.length) / 2)}\n`;
  r += `${"Period: " + params.period}\n`;
  r += `${"Reference No: " + params.refNo}\n`;
  r += `${"Generated: " + format(new Date(), "dd MMMM yyyy 'at' HH:mm")}\n`;
  r += `${line}\n\n`;

  params.sections.forEach((sec, i) => {
    r += `${i + 1}. ${sec.heading.toUpperCase()}\n${dline}\n`;
    sec.rows.forEach(([label, value]) => {
      r += `${pad(label, 44)} ${rpad(value, W - 45)}\n`;
    });
    r += "\n";
  });

  if (params.aiAnalysis) {
    r += `${line}\n`;
    r += `AI-GENERATED FINANCIAL ANALYSIS\n${dline}\n`;
    r += params.aiAnalysis + "\n\n";
    r += `[AI DISCLAIMER] Generated by Google Gemini via Lovable AI Gateway.\n`;
    r += `For informational and audit purposes only. Not financial advice.\n`;
  }

  r += `${line}\n`;
  r += `ANALYST ENDORSEMENT\n${dline}\n`;
  r += `${pad("Prepared & Endorsed By:", 44)} ${rpad(ANALYST.name, W - 45)}\n`;
  r += `${pad("Title:", 44)} ${rpad(ANALYST.title, W - 45)}\n`;
  r += `${pad("Institution:", 44)} ${rpad(ANALYST.institution, W - 45)}\n`;
  r += `${pad("Date:", 44)} ${rpad(format(new Date(), "dd MMMM yyyy"), W - 45)}\n`;
  r += `${pad("Signature:", 44)} ${rpad("_".repeat(30), W - 45)}\n\n`;

  r += `${line}\n`;
  r += `END OF REPORT — KINONI SACCO MANAGEMENT SYSTEM\n`;
  r += `This is a computer-generated report. Reference: ${params.refNo}\n`;
  r += `${line}\n`;
  return r;
}

// ════════════════════════════════════════════════════════════════════════════
// BANK-FORMAT EXCEL REPORT
// ════════════════════════════════════════════════════════════════════════════
export function generateBankExcel(params: {
  type: "member" | "group";
  filename: string;
  sheets: { name: string; data: (string | number)[][] }[];
  aiAnalysis?: string;
}) {
  const wb = XLSX.utils.book_new();

  params.sheets.forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data);

    // Auto column widths
    const colWidths = sheet.data.reduce((acc: number[], row) => {
      row.forEach((cell, i) => {
        const len = String(cell ?? "").length;
        acc[i] = Math.max(acc[i] ?? 0, len);
      });
      return acc;
    }, [] as number[]).map((w: number) => ({ wch: Math.min(Math.max(w, 10), 50) }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  if (params.aiAnalysis) {
    const aiRows: (string | number)[][] = [
      ["KINONI SACCO — AI FINANCIAL ANALYSIS"],
      [`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`],
      [],
      ["AI-Generated Report"],
      [],
      ...params.aiAnalysis.split("\n").map(line => [line]),
      [],
      ["DISCLAIMER: Generated by Google Gemini via Lovable AI Gateway. For informational purposes only."],
    ];
    const wsAI = XLSX.utils.aoa_to_sheet(aiRows);
    wsAI["!cols"] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsAI, "AI Analysis");
  }

  XLSX.writeFile(wb, params.filename);
}
