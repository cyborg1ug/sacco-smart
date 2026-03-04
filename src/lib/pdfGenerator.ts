import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, differenceInDays, differenceInMonths } from "date-fns";

interface Transaction {
  created_at: string;
  transaction_type: string;
  amount: number;
  balance_after?: number;
  status: string;
  description?: string;
  tnx_id?: string;
}

interface TransactionReceiptData {
  tnxId: string;
  memberName: string;
  accountNumber: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  currentBalance?: number;
  totalSavings?: number;
  description?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  loanInfo?: {
    principal: number;
    interestRate: number;
    totalInterest: number;
    principalPortion: number;
    interestPortion: number;
    outstandingBalance: number;
  };
}

interface Loan {
  amount: number;
  interest_rate: number;
  total_amount: number;
  outstanding_balance: number;
  status: string;
  repayment_months?: number;
  disbursed_at?: string;
  approved_at?: string;
  created_at?: string;
}

interface SavingsRecord {
  week_start: string;
  week_end: string;
  amount: number;
}

interface MemberStatementData {
  memberName: string;
  email: string;
  phoneNumber?: string;
  occupation?: string;
  accountNumber: string;
  balance: number;
  totalSavings: number;
  transactions: Transaction[];
  loans: Loan[];
  savings: SavingsRecord[];
}

interface MemberAccountBreakdown {
  name: string;
  accountNumber: string;
  accountType: string;
  balance: number;
  savings: number;
  activeLoans: number;
  outstandingBalance: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  overduePenalty?: number;
}

interface GroupReportData {
  totalMembers: number;
  totalBalance: number;
  totalSavings: number;
  totalOutstandingLoans: number;
  periodDeposits: number;
  periodWithdrawals: number;
  pendingLoans: number;
  approvedLoans: number;
  disbursedLoans: number;
  completedLoans: number;
  members: MemberAccountBreakdown[];
  dateRange: { start: Date; end: Date };
  allTimeDeposits?: number;
  allTimeWithdrawals?: number;
  allTimeRepayments?: number;
  allTimeDisbursements?: number;
  allTimeInterest?: number;
  overdueLoansCount?: number;
  totalOverdueBalance?: number;
  totalOverduePenalty?: number;
  periodRepayments?: number;
  periodInterest?: number;
}

const isLoanOverdue = (loan: Loan): boolean => {
  if (!loan.disbursed_at || !loan.repayment_months) return false;
  return differenceInMonths(new Date(), new Date(loan.disbursed_at)) > loan.repayment_months;
};

const getDaysOverdue = (loan: Loan): number => {
  if (!loan.disbursed_at || !loan.repayment_months) return 0;
  const dueDate = new Date(loan.disbursed_at);
  dueDate.setMonth(dueDate.getMonth() + loan.repayment_months);
  if (new Date() <= dueDate) return 0;
  return differenceInDays(new Date(), dueDate);
};

const addPageHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(18);
  doc.setTextColor(0, 100, 0);
  doc.text("KINONI SACCO", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text(title, pageWidth / 2, 23, { align: "center" });
  if (subtitle) {
    doc.setFontSize(9);
    doc.text(subtitle, pageWidth / 2, 30, { align: "center" });
  }
  doc.setDrawColor(0, 100, 0);
  doc.setLineWidth(0.5);
  doc.line(14, subtitle ? 34 : 27, pageWidth - 14, subtitle ? 34 : 27);
};

export const generateMemberStatementPDF = (data: MemberStatementData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  addPageHeader(doc, "Member Statement", `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`);

  // Member Info
  let y = 42;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("MEMBER INFORMATION", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    body: [
      ["Name", data.memberName],
      ["Email", data.email],
      ["Phone", data.phoneNumber || "N/A"],
      ["Occupation", data.occupation || "N/A"],
      ["Account Number", data.accountNumber],
      ["Current Balance", `UGX ${data.balance.toLocaleString()}`],
      ["Total Savings (All-time)", `UGX ${data.totalSavings.toLocaleString()}`],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
  });

  // Transaction History
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("TRANSACTION HISTORY", 14, y);

  // Compute all-time totals by type
  const txnTypes = ["deposit", "withdrawal", "loan_disbursement", "loan_repayment", "interest_received"];
  const totals: Record<string, number> = {};
  txnTypes.forEach(type => {
    totals[type] = data.transactions
      .filter(t => t.transaction_type === type && t.status === "approved")
      .reduce((s, t) => s + Number(t.amount), 0);
  });

  autoTable(doc, {
    startY: y + 4,
    head: [["Date & Time", "TXN ID", "Type", "Amount (UGX)", "Bal After (UGX)", "Status"]],
    body: data.transactions.map(t => [
      format(new Date(t.created_at), "MMM dd, yyyy HH:mm"),
      t.tnx_id || "-",
      t.transaction_type.replace(/_/g, " ").toUpperCase(),
      Number(t.amount).toLocaleString(),
      Number(t.balance_after ?? 0).toLocaleString(),
      t.status.toUpperCase(),
    ]),
    theme: "striped",
    headStyles: { fillColor: [0, 100, 0], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
    foot: [["", "", "TOTALS", "", "", ""]],
    footStyles: { fillColor: [230, 255, 230], fontStyle: "bold", fontSize: 8 },
  });

  // Totals summary table
  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ALL-TIME TRANSACTION TOTALS", 14, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["Transaction Type", "Total Amount (UGX)"]],
    body: txnTypes.map(type => [
      type.replace(/_/g, " ").toUpperCase(),
      totals[type].toLocaleString(),
    ]),
    theme: "grid",
    headStyles: { fillColor: [0, 80, 0], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });

  // Loan History
  if (data.loans.length > 0) {
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 240) { doc.addPage(); addPageHeader(doc, "Member Statement - Loans"); y = 42; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("LOAN HISTORY", 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [["Applied", "Principal", "Rate", "Months", "Total Interest", "Total Payable", "Repaid", "Outstanding", "Status", "Due Date"]],
      body: data.loans.map(l => {
        const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
        const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
        const dueDate = l.disbursed_at && l.repayment_months
          ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy")
          : "N/A";
        const overdue = isLoanOverdue(l);
        const days = getDaysOverdue(l);
        return [
          l.created_at ? format(new Date(l.created_at), "MMM dd, yyyy") : "N/A",
          Number(l.amount).toLocaleString(),
          `${l.interest_rate}%/mo`,
          l.repayment_months || "N/A",
          totalInterest.toLocaleString(),
          Number(l.total_amount).toLocaleString(),
          repaid.toLocaleString(),
          Number(l.outstanding_balance).toLocaleString(),
          overdue ? `OVERDUE (${days}d)` : l.status.toUpperCase(),
          dueDate,
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 0], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 1: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    });
  }

  // Savings Records
  if (data.savings.length > 0) {
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 250) { doc.addPage(); addPageHeader(doc, "Member Statement - Savings"); y = 42; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("WEEKLY SAVINGS RECORDS", 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [["Week Start", "Week End", "Amount (UGX)"]],
      body: data.savings.map(s => [
        format(new Date(s.week_start), "MMM dd, yyyy"),
        format(new Date(s.week_end), "MMM dd, yyyy"),
        Number(s.amount).toLocaleString(),
      ]),
      theme: "striped",
      headStyles: { fillColor: [0, 100, 0], fontSize: 9 },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" } },
    });
  }

  // Footer on each page
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const fY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${i} of ${totalPages} — KINONI SACCO Management System — Confidential`, pageWidth / 2, fY, { align: "center" });
  }

  doc.save(`kinoni_statement_${data.accountNumber}_${format(new Date(), "yyyyMMdd")}.pdf`);
};

export const generateGroupReportPDF = (data: GroupReportData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  addPageHeader(
    doc,
    "Comprehensive Group Report",
    `Period: ${format(data.dateRange.start, "MMM dd, yyyy")} – ${format(data.dateRange.end, "MMM dd, yyyy")}  |  Generated: ${format(new Date(), "MMM dd, yyyy hh:mm a")}`
  );

  let y = 42;

  // Executive Summary (no combined balances — only counts & loan totals)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("EXECUTIVE SUMMARY", 14, y);

  autoTable(doc, {
    startY: y + 4,
    body: [
      ["Total Members (Profiles)", data.totalMembers.toString()],
      ["Main Accounts", data.members.filter(m => m.accountType === "main").length.toString()],
      ["Sub-Accounts", data.members.filter(m => m.accountType === "sub").length.toString()],
      ["Active Outstanding Loans", `UGX ${data.totalOutstandingLoans.toLocaleString()}`],
      ["Overdue Loans", (data.overdueLoansCount || 0).toString()],
      ["Total Overdue Balance", `UGX ${(data.totalOverdueBalance || 0).toLocaleString()}`],
      ["Total Accrued Penalties", `UGX ${(data.totalOverduePenalty || 0).toLocaleString()}`],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
  });

  // All-Time Financial Totals
  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ALL-TIME FINANCIAL TOTALS", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Metric", "Amount (UGX)"]],
    body: [
      ["Total Deposits", (data.allTimeDeposits || 0).toLocaleString()],
      ["Total Withdrawals", (data.allTimeWithdrawals || 0).toLocaleString()],
      ["Net Deposits", ((data.allTimeDeposits || 0) - (data.allTimeWithdrawals || 0)).toLocaleString()],
      ["Total Loan Disbursements", (data.allTimeDisbursements || 0).toLocaleString()],
      ["Total Loan Repayments", (data.allTimeRepayments || 0).toLocaleString()],
      ["Total Interest Collected", (data.allTimeInterest || 0).toLocaleString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [0, 100, 0], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });

  // Period Activity
  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PERIOD ACTIVITY", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Metric", "Amount (UGX)"]],
    body: [
      ["Period Deposits", data.periodDeposits.toLocaleString()],
      ["Period Withdrawals", data.periodWithdrawals.toLocaleString()],
      ["Net Movement", (data.periodDeposits - data.periodWithdrawals).toLocaleString()],
      ["Period Disbursements", (data.allTimeDisbursements || 0).toLocaleString()],
      ["Period Repayments", (data.periodRepayments || 0).toLocaleString()],
      ["Period Interest Collected", (data.periodInterest || 0).toLocaleString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [0, 80, 160], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });

  // Loan Status
  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("LOAN PORTFOLIO", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Status", "Count"]],
    body: [
      ["Pending", data.pendingLoans.toString()],
      ["Approved", data.approvedLoans.toString()],
      ["Disbursed / Active", data.disbursedLoans.toString()],
      ["Completed / Fully Paid", data.completedLoans.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [0, 100, 0], fontSize: 9 },
    styles: { fontSize: 9 },
  });

  // Individual Member Breakdown — each member's own balance (no combined)
  doc.addPage();
  addPageHeader(doc, "Group Report — Individual Account Balances");
  y = 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("INDIVIDUAL ACCOUNT BALANCES", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Member Name", "Account No.", "Type", "Balance (UGX)", "Savings (UGX)", "Outstanding Loan (UGX)", "Status"]],
    body: data.members.map(m => [
      m.name,
      m.accountNumber,
      m.accountType.toUpperCase(),
      m.balance.toLocaleString(),
      m.savings.toLocaleString(),
      m.outstandingBalance > 0 ? m.outstandingBalance.toLocaleString() : "-",
      m.isOverdue ? `OVERDUE (${m.daysOverdue}d)` : m.outstandingBalance > 0 ? "Active Loan" : "OK",
    ]),
    theme: "striped",
    headStyles: { fillColor: [0, 100, 0], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    didParseCell: (hook) => {
      // Highlight overdue rows in light red
      const statusVal = hook.row.raw as string[];
      if (Array.isArray(statusVal) && String(statusVal[6]).startsWith("OVERDUE")) {
        hook.cell.styles.fillColor = [255, 230, 230];
        hook.cell.styles.textColor = [180, 0, 0];
      }
    },
  });

  // Footer on each page
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const fY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${i} of ${totalPages} — KINONI SACCO Management System — Confidential`, pageWidth / 2, fY, { align: "center" });
  }

  doc.save(`kinoni_group_report_${format(new Date(), "yyyyMMdd")}.pdf`);
};

export const generateTransactionReceiptPDF = (data: TransactionReceiptData): void => {
  const doc = new jsPDF({ format: [148, 210] });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setTextColor(0, 100, 0);
  doc.text("KINONI SACCO", pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("TRANSACTION RECEIPT", pageWidth / 2, 23, { align: "center" });

  doc.setDrawColor(0, 100, 0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageWidth - 10, 195);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Transaction ID:", 10, 35);
  doc.setFontSize(14);
  doc.setTextColor(0, 100, 0);
  doc.setFont("helvetica", "bold");
  doc.text(data.tnxId, pageWidth - 10, 35, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setDrawColor(200, 200, 200);
  doc.line(10, 40, pageWidth - 10, 40);

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  let yPos = 50;
  const lineHeight = 8;

  const details = [
    { label: "Date:", value: format(new Date(data.createdAt), "MMM dd, yyyy 'at' hh:mm a") },
    { label: "Member Name:", value: data.memberName },
    { label: "Account Number:", value: data.accountNumber },
    { label: "Transaction Type:", value: data.transactionType.replace("_", " ").toUpperCase() },
  ];

  details.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.text(item.label, 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(item.value, pageWidth - 10, yPos, { align: "right" });
    yPos += lineHeight;
  });

  yPos += 5;
  doc.setDrawColor(0, 100, 0);
  doc.setFillColor(240, 255, 240);
  doc.rect(10, yPos - 5, pageWidth - 20, data.loanInfo ? 45 : 20, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Amount:", 15, yPos + 3);

  doc.setFontSize(14);
  doc.setTextColor(0, 100, 0);
  doc.text(`UGX ${data.amount.toLocaleString()}`, pageWidth - 15, yPos + 3, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.text("Balance After Transaction:", 15, yPos + 12);
  doc.text(`UGX ${data.balanceAfter.toLocaleString()}`, pageWidth - 15, yPos + 12, { align: "right" });

  if (data.loanInfo && data.transactionType === "loan_repayment") {
    doc.setDrawColor(100, 100, 100);
    doc.line(15, yPos + 17, pageWidth - 15, yPos + 17);

    doc.setFont("helvetica", "bold");
    doc.text("Interest Breakdown:", 15, yPos + 23);
    doc.setFont("helvetica", "normal");

    doc.text("Principal Portion:", 15, yPos + 29);
    doc.text(`UGX ${data.loanInfo.principalPortion.toLocaleString()}`, pageWidth - 15, yPos + 29, { align: "right" });

    doc.text("Interest Portion:", 15, yPos + 35);
    doc.setTextColor(0, 100, 0);
    doc.text(`UGX ${data.loanInfo.interestPortion.toLocaleString()}`, pageWidth - 15, yPos + 35, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.text("Loan Outstanding:", 15, yPos + 41);
    doc.setTextColor(200, 100, 0);
    doc.text(`UGX ${data.loanInfo.outstandingBalance.toLocaleString()}`, pageWidth - 15, yPos + 41, { align: "right" });

    yPos += 30;
  }

  doc.setTextColor(0, 0, 0);
  if (data.currentBalance !== undefined) {
    doc.text("Current Account Balance:", 15, yPos + (data.loanInfo ? 18 : 18));
    doc.text(`UGX ${data.currentBalance.toLocaleString()}`, pageWidth - 15, yPos + (data.loanInfo ? 18 : 18), { align: "right" });
  }

  if (data.totalSavings !== undefined) {
    doc.text("Total Savings:", 15, yPos + (data.loanInfo ? 24 : 24));
    doc.text(`UGX ${data.totalSavings.toLocaleString()}`, pageWidth - 15, yPos + (data.loanInfo ? 24 : 24), { align: "right" });
  }

  yPos += data.currentBalance !== undefined && data.totalSavings !== undefined ? 42 : 30;

  if (data.description) {
    doc.setFont("helvetica", "bold");
    doc.text("Description:", 10, yPos);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(data.description, pageWidth - 20);
    doc.text(descLines, 10, yPos + 6);
    yPos += 6 + (descLines.length * 5);
  }

  yPos += 10;
  doc.line(10, yPos, pageWidth - 10, yPos);
  yPos += 8;

  if (data.approvedAt) {
    doc.setFont("helvetica", "bold");
    doc.text("Approved:", 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(data.approvedAt), "MMM dd, yyyy 'at' hh:mm a"), pageWidth - 10, yPos, { align: "right" });
    yPos += lineHeight;
  }

  doc.setFontSize(12);
  doc.setTextColor(0, 128, 0);
  doc.setFont("helvetica", "bold");
  doc.text("✓ APPROVED", pageWidth / 2, yPos + 10, { align: "center" });

  const footerY = 190;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("This receipt is generated by KINONI SACCO Management System.", pageWidth / 2, footerY, { align: "center" });
  doc.text("Keep this receipt for your records.", pageWidth / 2, footerY + 5, { align: "center" });

  doc.save(`receipt_${data.tnxId}_${format(new Date(), "yyyyMMdd")}.pdf`);
};
