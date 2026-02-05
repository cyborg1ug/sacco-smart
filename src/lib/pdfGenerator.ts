import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface Transaction {
  created_at: string;
  transaction_type: string;
  amount: number;
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
  // Loan repayment specific
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
  accountNumber: string;
  balance: number;
  totalSavings: number;
  transactions: Transaction[];
  loans: Loan[];
  savings: SavingsRecord[];
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
  members: {
    name: string;
    accountNumber: string;
    balance: number;
    savings: number;
  }[];
  dateRange: { start: Date; end: Date };
}

export const generateMemberStatementPDF = (data: MemberStatementData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 100, 0);
  doc.text("KINONI SACCO", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("Member Statement", pageWidth / 2, 30, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`, pageWidth / 2, 38, { align: "center" });
  
  // Member Info
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("ACCOUNT DETAILS", 14, 50);
  doc.setDrawColor(0, 100, 0);
  doc.line(14, 52, pageWidth - 14, 52);
  
  doc.setFontSize(10);
  doc.text(`Member Name: ${data.memberName}`, 14, 60);
  doc.text(`Email: ${data.email}`, 14, 66);
  doc.text(`Phone: ${data.phoneNumber || "N/A"}`, 14, 72);
  doc.text(`Account Number: ${data.accountNumber}`, 14, 78);
  
  doc.setFontSize(11);
  doc.setTextColor(0, 100, 0);
  doc.text(`Current Balance: UGX ${data.balance.toLocaleString()}`, 14, 88);
  doc.text(`Total Savings: UGX ${data.totalSavings.toLocaleString()}`, 14, 94);
  
  // Transactions Table
  let startY = 105;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("TRANSACTION HISTORY", 14, startY);
  
  if (data.transactions.length > 0) {
    autoTable(doc, {
      startY: startY + 5,
      head: [["Date", "Type", "Amount (UGX)", "Status"]],
      body: data.transactions.map((t) => [
        format(new Date(t.created_at), "MMM dd, yyyy"),
        t.transaction_type.toUpperCase().replace("_", " "),
        t.amount.toLocaleString(),
        t.status.toUpperCase(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 0] },
      styles: { fontSize: 9 },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("No transactions found.", 14, startY + 10);
  }
  
  // Savings Table
  const savingsY = (doc as any).lastAutoTable?.finalY + 15 || startY + 25;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("SAVINGS RECORDS", 14, savingsY);
  
  if (data.savings.length > 0) {
    autoTable(doc, {
      startY: savingsY + 5,
      head: [["Week", "Amount (UGX)"]],
      body: data.savings.map((s) => [
        `${format(new Date(s.week_start), "MMM dd")} - ${format(new Date(s.week_end), "MMM dd, yyyy")}`,
        s.amount.toLocaleString(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 0] },
      styles: { fontSize: 9 },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("No savings records found.", 14, savingsY + 10);
  }
  
  // Loans Table
  const loansY = (doc as any).lastAutoTable?.finalY + 15 || savingsY + 25;
  
  if (loansY > 250) {
    doc.addPage();
  }
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("LOAN HISTORY", 14, loansY > 250 ? 20 : loansY);
  
  if (data.loans.length > 0) {
    autoTable(doc, {
      startY: (loansY > 250 ? 20 : loansY) + 5,
      head: [["Principal", "Interest Rate", "Total Interest", "Total Payable", "Outstanding", "Status"]],
      body: data.loans.map((l) => [
        l.amount.toLocaleString(),
        `${l.interest_rate}%`,
        (l.total_amount - l.amount).toLocaleString(),
        l.total_amount.toLocaleString(),
        l.outstanding_balance.toLocaleString(),
        l.status.toUpperCase(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 0] },
      styles: { fontSize: 8 },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("No loan records found.", 14, (loansY > 250 ? 20 : loansY) + 10);
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("This statement is generated by KINONI SACCO Management System.", pageWidth / 2, footerY, { align: "center" });
  
  doc.save(`kinoni_statement_${data.accountNumber}_${format(new Date(), "yyyyMMdd")}.pdf`);
};

export const generateGroupReportPDF = (data: GroupReportData): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(0, 100, 0);
  doc.text("KINONI SACCO", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("Group Report", pageWidth / 2, 30, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`Period: ${format(data.dateRange.start, "MMM dd, yyyy")} - ${format(data.dateRange.end, "MMM dd, yyyy")}`, pageWidth / 2, 38, { align: "center" });
  doc.text(`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`, pageWidth / 2, 44, { align: "center" });
  
  // Executive Summary
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("EXECUTIVE SUMMARY", 14, 56);
  doc.setDrawColor(0, 100, 0);
  doc.line(14, 58, pageWidth - 14, 58);
  
  doc.setFontSize(10);
  const summaryData = [
    ["Total Members", data.totalMembers.toString()],
    ["Combined Balance", `UGX ${data.totalBalance.toLocaleString()}`],
    ["Combined Savings", `UGX ${data.totalSavings.toLocaleString()}`],
    ["Outstanding Loans", `UGX ${data.totalOutstandingLoans.toLocaleString()}`],
  ];
  
  autoTable(doc, {
    startY: 62,
    body: summaryData,
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold" } },
  });
  
  // Period Activity
  const activityY = (doc as any).lastAutoTable?.finalY + 10 || 100;
  doc.setFontSize(12);
  doc.text("PERIOD ACTIVITY", 14, activityY);
  doc.line(14, activityY + 2, pageWidth - 14, activityY + 2);
  
  autoTable(doc, {
    startY: activityY + 6,
    body: [
      ["Total Deposits", `UGX ${data.periodDeposits.toLocaleString()}`],
      ["Total Withdrawals", `UGX ${data.periodWithdrawals.toLocaleString()}`],
      ["Net Movement", `UGX ${(data.periodDeposits - data.periodWithdrawals).toLocaleString()}`],
    ],
    theme: "plain",
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: "bold" } },
  });
  
  // Loan Portfolio
  const loanY = (doc as any).lastAutoTable?.finalY + 10 || 140;
  doc.setFontSize(12);
  doc.text("LOAN PORTFOLIO", 14, loanY);
  doc.line(14, loanY + 2, pageWidth - 14, loanY + 2);
  
  autoTable(doc, {
    startY: loanY + 6,
    head: [["Status", "Count"]],
    body: [
      ["Pending", data.pendingLoans.toString()],
      ["Approved", data.approvedLoans.toString()],
      ["Disbursed", data.disbursedLoans.toString()],
      ["Completed", data.completedLoans.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [0, 100, 0] },
    styles: { fontSize: 9 },
  });
  
  // Member Breakdown
  const memberY = (doc as any).lastAutoTable?.finalY + 15 || 180;
  
  if (memberY > 220) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text("MEMBER BREAKDOWN", 14, 20);
    doc.line(14, 22, pageWidth - 14, 22);
    
    autoTable(doc, {
      startY: 26,
      head: [["Member Name", "Account No.", "Balance (UGX)", "Savings (UGX)"]],
      body: data.members.map((m) => [
        m.name,
        m.accountNumber,
        m.balance.toLocaleString(),
        m.savings.toLocaleString(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 0] },
      styles: { fontSize: 9 },
    });
  } else {
    doc.setFontSize(12);
    doc.text("MEMBER BREAKDOWN", 14, memberY);
    doc.line(14, memberY + 2, pageWidth - 14, memberY + 2);
    
    autoTable(doc, {
      startY: memberY + 6,
      head: [["Member Name", "Account No.", "Balance (UGX)", "Savings (UGX)"]],
      body: data.members.map((m) => [
        m.name,
        m.accountNumber,
        m.balance.toLocaleString(),
        m.savings.toLocaleString(),
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 100, 0] },
      styles: { fontSize: 9 },
    });
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("This report is generated by KINONI SACCO Management System.", pageWidth / 2, footerY, { align: "center" });
  
  doc.save(`kinoni_group_report_${format(new Date(), "yyyyMMdd")}.pdf`);
};

export const generateTransactionReceiptPDF = (data: TransactionReceiptData): void => {
  const doc = new jsPDF({
    format: [148, 210], // A5 size
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(0, 100, 0);
  doc.text("KINONI SACCO", pageWidth / 2, 15, { align: "center" });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text("TRANSACTION RECEIPT", pageWidth / 2, 23, { align: "center" });
  
  // Receipt border
  doc.setDrawColor(0, 100, 0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageWidth - 10, 195);
  
  // Transaction ID prominently displayed
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
  
  // Transaction details
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
  
  // Amount section with emphasis
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
  
  // Loan repayment interest breakdown
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
  
  // Show current balance and savings if available
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
  
  
  
  // Description
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
  
  // Approval info
  if (data.approvedAt) {
    doc.setFont("helvetica", "bold");
    doc.text("Approved:", 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(data.approvedAt), "MMM dd, yyyy 'at' hh:mm a"), pageWidth - 10, yPos, { align: "right" });
    yPos += lineHeight;
  }
  
  // Status
  doc.setFontSize(12);
  doc.setTextColor(0, 128, 0);
  doc.setFont("helvetica", "bold");
  doc.text("✓ APPROVED", pageWidth / 2, yPos + 10, { align: "center" });
  
  // Footer
  const footerY = 190;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text("This receipt is generated by KINONI SACCO Management System.", pageWidth / 2, footerY, { align: "center" });
  doc.text("Keep this receipt for your records.", pageWidth / 2, footerY + 5, { align: "center" });
  
  doc.save(`receipt_${data.tnxId}_${format(new Date(), "yyyyMMdd")}.pdf`);
};
