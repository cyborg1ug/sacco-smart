import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, TrendingUp, Users, Wallet, FileDown, BarChart3, Table as TableIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, differenceInMonths, differenceInDays } from "date-fns";
import FinancialCharts from "../charts/FinancialCharts";
import { generateMemberStatementPDF, generateGroupReportPDF } from "@/lib/pdfGenerator";
import * as XLSX from "xlsx";

const ReportsGeneration = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [reportPeriod, setReportPeriod] = useState("current");
  const [showCharts, setShowCharts] = useState(false);
  const [chartData, setChartData] = useState<{
    transactionData: { month: string; deposits: number; withdrawals: number }[];
    loanData: { name: string; value: number }[];
    balanceData: { date: string; balance: number }[];
    savingsData: { week: string; amount: number }[];
  } | null>(null);

  useEffect(() => {
    if (showCharts) loadChartData();
  }, [showCharts, reportPeriod]);

  const loadMembers = async () => {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type");

    if (accountsData && accountsData.length > 0) {
      const mainAccounts = accountsData.filter(a => a.account_type === 'main');
      const userIds = [...new Set(mainAccounts.map(a => a.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const accountsMap = new Map<string, any[]>();
      mainAccounts.forEach(acc => {
        if (!accountsMap.has(acc.user_id)) accountsMap.set(acc.user_id, []);
        accountsMap.get(acc.user_id)!.push(acc);
      });

      const membersWithAccounts = profilesData?.map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        accounts: accountsMap.get(profile.id) || []
      })) || [];
      setMembers(membersWithAccounts);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    if (reportPeriod === "current") return { start: startOfMonth(now), end: now };
    if (reportPeriod === "last") {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    if (reportPeriod === "quarter") return { start: subMonths(now, 3), end: now };
    return { start: subMonths(now, 12), end: now };
  };

  const loadChartData = async () => {
    const dateRange = getDateRange();
    const { data: transactions } = await supabase
      .from("transactions").select("*").eq("status", "approved")
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());
    const { data: loans } = await supabase.from("loans").select("status");
    const { data: accounts } = await supabase.from("accounts").select("balance, total_savings, created_at");
    const { data: savings } = await supabase.from("savings").select("*")
      .gte("week_start", dateRange.start.toISOString()).order("week_start", { ascending: true });

    const monthlyData: { [key: string]: { deposits: number; withdrawals: number } } = {};
    transactions?.forEach((t) => {
      const month = format(new Date(t.created_at), "MMM");
      if (!monthlyData[month]) monthlyData[month] = { deposits: 0, withdrawals: 0 };
      if (t.transaction_type === "deposit") monthlyData[month].deposits += Number(t.amount);
      else if (t.transaction_type === "withdrawal") monthlyData[month].withdrawals += Number(t.amount);
    });
    const transactionData = Object.entries(monthlyData).map(([month, data]) => ({ month, ...data }));
    const loanStatusCount: { [key: string]: number } = {};
    loans?.forEach((l) => { loanStatusCount[l.status] = (loanStatusCount[l.status] || 0) + 1; });
    const loanData = Object.entries(loanStatusCount).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    }));
    const savingsData = savings?.map((s) => ({
      week: format(new Date(s.week_start), "MMM dd"), amount: Number(s.amount),
    })) || [];
    const totalBalance = accounts?.reduce((sum, a) => sum + Number(a.balance), 0) || 0;
    const balanceData = [{ date: format(new Date(), "MMM dd"), balance: totalBalance }];
    setChartData({ transactionData, loanData, savingsData, balanceData });
  };

  const isLoanOverdue = (loan: any): boolean => {
    if (!loan.disbursed_at || !loan.repayment_months) return false;
    const monthsElapsed = differenceInMonths(new Date(), new Date(loan.disbursed_at));
    return monthsElapsed > loan.repayment_months;
  };

  const getDaysOverdue = (loan: any): number => {
    if (!loan.disbursed_at || !loan.repayment_months) return 0;
    const dueDate = new Date(loan.disbursed_at);
    dueDate.setMonth(dueDate.getMonth() + loan.repayment_months);
    if (new Date() <= dueDate) return 0;
    return differenceInDays(new Date(), dueDate);
  };

  const calcDailyOverdueInterest = (loan: any): number => {
    const days = getDaysOverdue(loan);
    if (days <= 0) return 0;
    const dailyRate = (Number(loan.interest_rate) / 100) / 30;
    return Math.round(Number(loan.amount) * dailyRate * days);
  };

  // ─── FETCH MEMBER DATA ───────────────────────────────────────────────
  const fetchMemberData = async (profileId: string) => {
    const dateRange = getDateRange();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone_number, occupation")
      .eq("id", profileId)
      .single();

    const { data: memberAccount } = await supabase
      .from("accounts")
      .select("id, account_number, balance, total_savings")
      .eq("user_id", profileId)
      .eq("account_type", "main")
      .maybeSingle();

    if (!profile || !memberAccount) return null;

    const accountId = memberAccount.id;

    const [{ data: periodTxns }, { data: allTxns }, { data: savings }, { data: loans }] = await Promise.all([
      supabase.from("transactions").select("*")
        .eq("account_id", accountId)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("transactions").select("*")
        .eq("account_id", accountId).eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase.from("savings").select("*")
        .eq("account_id", accountId)
        .gte("week_start", dateRange.start.toISOString())
        .lte("week_end", dateRange.end.toISOString()),
      supabase.from("loans").select("*").eq("account_id", accountId),
    ]);

    return { profile, memberAccount, periodTxns, allTxns, savings, loans, dateRange };
  };

  // ─── MEMBER REPORT (TEXT) ──────────────────────────────────────────
  const generateMemberReport = async (asPdf = false, asExcel = false) => {
    if (!selectedMember) {
      toast({ title: "Error", description: "Please select a member", variant: "destructive" });
      return;
    }
    setLoading(true);
    const data = await fetchMemberData(selectedMember);
    if (!data) {
      toast({ title: "Error", description: "Member not found", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { profile, memberAccount, periodTxns, allTxns, savings, loans, dateRange } = data;

    if (asPdf) {
      // Filter loans disbursed within the period
      const periodLoans = (loans || []).filter(l => {
        if (l.disbursed_at) {
          const disbDate = new Date(l.disbursed_at);
          return disbDate >= dateRange.start && disbDate <= dateRange.end;
        }
        // Include pending/approved loans created in period
        const createdDate = new Date(l.created_at);
        return createdDate >= dateRange.start && createdDate <= dateRange.end;
      });

      generateMemberStatementPDF({
        memberName: profile.full_name,
        email: profile.email,
        phoneNumber: profile.phone_number,
        occupation: profile.occupation,
        accountNumber: memberAccount.account_number,
        balance: Number(memberAccount.balance),
        totalSavings: Number(memberAccount.total_savings),
        transactions: (periodTxns || []),
        loans: periodLoans,
        savings: savings || [],
      });
      toast({ title: "Success", description: "PDF report generated" });
      setLoading(false);
      return;
    }

    if (asExcel) {
      await generateMemberExcel(data);
      setLoading(false);
      return;
    }

    // ── Text report ─────────────────────────────────────────────
    const sum = (arr: any[], type: string) =>
      (arr || []).filter(t => t.transaction_type === type && t.status === "approved")
        .reduce((s, t) => s + Number(t.amount), 0);

    const pDep = sum(periodTxns || [], "deposit");
    const pWit = sum(periodTxns || [], "withdrawal");
    const pRep = sum(periodTxns || [], "loan_repayment");
    const pDisb = sum(periodTxns || [], "loan_disbursement");
    const pInt = sum(periodTxns || [], "interest_received");
    const pSav = (savings || []).reduce((s, sv) => s + Number(sv.amount), 0);

    const aDep = sum(allTxns || [], "deposit");
    const aWit = sum(allTxns || [], "withdrawal");
    const aRep = sum(allTxns || [], "loan_repayment");
    const aDisb = sum(allTxns || [], "loan_disbursement");
    const aInt = sum(allTxns || [], "interest_received");

    const activeLoansData = (loans || []).filter(l => ["disbursed", "active"].includes(l.status) && l.outstanding_balance > 0);
    const completedLoans = (loans || []).filter(l => ["completed", "fully_paid"].includes(l.status));
    const overdueLoans = activeLoansData.filter(l => isLoanOverdue(l));

    let report = `KINONI SACCO - MEMBER FINANCIAL REPORT\n`;
    report += `${"═".repeat(75)}\n`;
    report += `Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}\n`;
    report += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

    report += `MEMBER INFORMATION\n${"─".repeat(75)}\n`;
    report += `Name:             ${profile.full_name}\nEmail:            ${profile.email}\n`;
    report += `Phone:            ${profile.phone_number || "N/A"}\nOccupation:       ${profile.occupation || "N/A"}\n`;
    report += `Account Number:   ${memberAccount.account_number}\n\n`;

    report += `CURRENT ACCOUNT BALANCES\n${"─".repeat(75)}\n`;
    report += `Account Balance:              UGX ${Number(memberAccount.balance).toLocaleString()}\n`;
    report += `Total Savings (all-time):     UGX ${Number(memberAccount.total_savings).toLocaleString()}\n\n`;

    report += `ALL-TIME TRANSACTION TOTALS\n${"─".repeat(75)}\n`;
    report += `Total Deposits:               UGX ${aDep.toLocaleString()}\n`;
    report += `Total Withdrawals:            UGX ${aWit.toLocaleString()}\n`;
    report += `Net Deposits:                 UGX ${(aDep - aWit).toLocaleString()}\n`;
    report += `Total Loan Disbursements:     UGX ${aDisb.toLocaleString()}\n`;
    report += `Total Loan Repayments:        UGX ${aRep.toLocaleString()}\n`;
    report += `Total Interest Paid:          UGX ${aInt.toLocaleString()}\n\n`;

    report += `PERIOD ACTIVITY (${format(dateRange.start, "MMM dd")} - ${format(dateRange.end, "MMM dd, yyyy")})\n${"─".repeat(75)}\n`;
    report += `Deposits:                     UGX ${pDep.toLocaleString()}\n`;
    report += `Withdrawals:                  UGX ${pWit.toLocaleString()}\n`;
    report += `Net Deposits:                 UGX ${(pDep - pWit).toLocaleString()}\n`;
    report += `Loan Disbursements:           UGX ${pDisb.toLocaleString()}\n`;
    report += `Loan Repayments:              UGX ${pRep.toLocaleString()}\n`;
    report += `Interest Paid:                UGX ${pInt.toLocaleString()}\n`;
    report += `Weekly Savings Recorded:      UGX ${pSav.toLocaleString()}\n\n`;

    if (activeLoansData.length > 0) {
      report += `ACTIVE LOANS\n${"─".repeat(75)}\n`;
      activeLoansData.forEach((l, i) => {
        const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A";
        const dueDate = l.disbursed_at && l.repayment_months
          ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy") : "N/A";
        const amountRepaid = Number(l.total_amount) - Number(l.outstanding_balance);
        const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
        const overdue = isLoanOverdue(l);
        const daysOverdue = getDaysOverdue(l);
        const dailyPenalty = calcDailyOverdueInterest(l);
        report += `Loan ${i + 1}:\n`;
        report += `  Principal:                UGX ${Number(l.amount).toLocaleString()}\n`;
        report += `  Interest Rate:            ${l.interest_rate}% per month × ${l.repayment_months} months\n`;
        report += `  Total Interest:           UGX ${totalInterest.toLocaleString()}\n`;
        report += `  Total Payable:            UGX ${Number(l.total_amount).toLocaleString()}\n`;
        report += `  Amount Repaid:            UGX ${amountRepaid.toLocaleString()}\n`;
        report += `  Outstanding Balance:      UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
        report += `  Disbursed On:             ${disbDate}\n`;
        report += `  Due Date:                 ${dueDate}\n`;
        report += `  Status:                   ${overdue ? `⚠ OVERDUE (${daysOverdue} days)` : "Active"}\n`;
        if (overdue && dailyPenalty > 0) {
          report += `  Accrued Overdue Penalty:  UGX ${dailyPenalty.toLocaleString()}\n`;
        }
        report += `\n`;
      });
    }

    if (overdueLoans.length > 0) {
      report += `OVERDUE LOAN DETAILS\n${"─".repeat(75)}\n`;
      report += `WARNING: The following loans are past their repayment period:\n\n`;
      overdueLoans.forEach(l => {
        const daysOverdue = getDaysOverdue(l);
        const penalty = calcDailyOverdueInterest(l);
        const dueDate = format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy");
        report += `  Due Date:                 ${dueDate}\n`;
        report += `  Outstanding Balance:      UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
        report += `  Days Overdue:             ${daysOverdue} days\n`;
        report += `  Daily Penalty (2%/30d):   UGX ${penalty.toLocaleString()}\n\n`;
      });
    }

    if (completedLoans.length > 0) {
      report += `COMPLETED LOANS\n${"─".repeat(75)}\n`;
      completedLoans.forEach((l, i) => {
        const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
        report += `Loan ${i + 1}: Principal UGX ${Number(l.amount).toLocaleString()} | Total Paid: UGX ${Number(l.total_amount).toLocaleString()} | Interest: UGX ${totalInterest.toLocaleString()} | ${l.status.toUpperCase()}\n`;
      });
      report += `\n`;
    }

    report += `ALL-TIME TRANSACTION HISTORY\n${"─".repeat(75)}\n`;
    const colDate = "Date".padEnd(22);
    const colType = "Type".padEnd(24);
    const colAmt = "Amount (UGX)".padStart(14);
    const colBal = "Bal After (UGX)".padStart(16);
    const colStatus = "Status".padEnd(10);
    report += `${colDate}${colType}${colAmt}${colBal}  ${colStatus}\n`;
    report += `${"─".repeat(75)}\n`;
    (allTxns || []).forEach(t => {
      report += `${format(new Date(t.created_at), "MMM dd, yyyy HH:mm").padEnd(22)}`;
      report += `${t.transaction_type.replace(/_/g, " ").toUpperCase().padEnd(24)}`;
      report += `${Number(t.amount).toLocaleString().padStart(14)}`;
      report += `${Number(t.balance_after).toLocaleString().padStart(16)}  `;
      report += `${(t.status || "").toUpperCase().padEnd(10)}\n`;
    });

    report += `\n${"═".repeat(75)}\nEnd of Report - KINONI SACCO Management System\n`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinoni_member_report_${memberAccount.account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Member report generated" });
    setLoading(false);
  };

  // ─── MEMBER EXCEL EXPORT ──────────────────────────────────────────
  const generateMemberExcel = async (data: any) => {
    const { profile, memberAccount, periodTxns, allTxns, savings, loans, dateRange } = data;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const sum = (arr: any[], type: string) =>
      (arr || []).filter((t: any) => t.transaction_type === type && t.status === "approved")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);

    const summaryData = [
      ["KINONI SACCO - MEMBER REPORT"],
      [`Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`],
      [`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`],
      [],
      ["MEMBER INFORMATION"],
      ["Name", profile.full_name],
      ["Email", profile.email],
      ["Phone", profile.phone_number || "N/A"],
      ["Occupation", profile.occupation || "N/A"],
      ["Account Number", memberAccount.account_number],
      [],
      ["CURRENT BALANCES"],
      ["Account Balance (UGX)", Number(memberAccount.balance)],
      ["Total Savings (UGX)", Number(memberAccount.total_savings)],
      [],
      ["ALL-TIME TOTALS"],
      ["Total Deposits (UGX)", sum(allTxns, "deposit")],
      ["Total Withdrawals (UGX)", sum(allTxns, "withdrawal")],
      ["Net Deposits (UGX)", sum(allTxns, "deposit") - sum(allTxns, "withdrawal")],
      ["Total Disbursements (UGX)", sum(allTxns, "loan_disbursement")],
      ["Total Repayments (UGX)", sum(allTxns, "loan_repayment")],
      ["Total Interest Paid (UGX)", sum(allTxns, "interest_received")],
      [],
      ["PERIOD ACTIVITY"],
      ["Period Deposits (UGX)", sum(periodTxns, "deposit")],
      ["Period Withdrawals (UGX)", sum(periodTxns, "withdrawal")],
      ["Period Disbursements (UGX)", sum(periodTxns, "loan_disbursement")],
      ["Period Repayments (UGX)", sum(periodTxns, "loan_repayment")],
      ["Period Interest Paid (UGX)", sum(periodTxns, "interest_received")],
      ["Period Savings (UGX)", (savings || []).reduce((s: number, sv: any) => s + Number(sv.amount), 0)],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Sheet 2: All Transactions
    const txnHeaders = ["Date", "TXN ID", "Type", "Amount (UGX)", "Balance After (UGX)", "Status", "Description"];
    const txnRows = (allTxns || []).map((t: any) => [
      format(new Date(t.created_at), "MMM dd, yyyy HH:mm"),
      t.tnx_id,
      t.transaction_type.replace(/_/g, " ").toUpperCase(),
      Number(t.amount),
      Number(t.balance_after),
      (t.status || "").toUpperCase(),
      t.description || "",
    ]);
    const wsTxns = XLSX.utils.aoa_to_sheet([txnHeaders, ...txnRows]);
    XLSX.utils.book_append_sheet(wb, wsTxns, "Transactions");

    // Sheet 3: Loans
    const loanHeaders = ["Principal (UGX)", "Interest Rate", "Repayment Months", "Total Payable (UGX)", "Total Interest (UGX)", "Amount Repaid (UGX)", "Outstanding (UGX)", "Status", "Disbursed On", "Due Date", "Days Overdue", "Overdue Penalty (UGX)"];
    const loanRows = (loans || []).map((l: any) => {
      const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
      const amountRepaid = Number(l.total_amount) - Number(l.outstanding_balance);
      const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A";
      const dueDate = l.disbursed_at && l.repayment_months
        ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy") : "N/A";
      const days = getDaysOverdue(l);
      const penalty = calcDailyOverdueInterest(l);
      return [Number(l.amount), `${l.interest_rate}%`, l.repayment_months, Number(l.total_amount), totalInterest, amountRepaid, Number(l.outstanding_balance), l.status.toUpperCase(), disbDate, dueDate, days, penalty];
    });
    const wsLoans = XLSX.utils.aoa_to_sheet([loanHeaders, ...loanRows]);
    XLSX.utils.book_append_sheet(wb, wsLoans, "Loans");

    // Sheet 4: Savings
    const savingsHeaders = ["Week Start", "Week End", "Amount (UGX)"];
    const savingsRows = (savings || []).map((s: any) => [
      format(new Date(s.week_start), "MMM dd, yyyy"),
      format(new Date(s.week_end), "MMM dd, yyyy"),
      Number(s.amount),
    ]);
    const wsSavings = XLSX.utils.aoa_to_sheet([savingsHeaders, ...savingsRows]);
    XLSX.utils.book_append_sheet(wb, wsSavings, "Savings");

    XLSX.writeFile(wb, `kinoni_member_report_${memberAccount.account_number}_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast({ title: "Success", description: "Excel report downloaded" });
  };

  // ─── GROUP REPORT ─────────────────────────────────────────────────
  const generateGroupReport = async (asPdf = false, asExcel = false) => {
    setLoading(true);
    const dateRange = getDateRange();

    const { data: accounts } = await supabase.from("accounts").select("*");
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: subProfiles } = await supabase.from("sub_account_profiles").select("*");
    const { data: allPeriodTxns } = await supabase.from("transactions").select("*")
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());
    const { data: allTxns } = await supabase.from("transactions").select("*").eq("status", "approved");
    const { data: allLoans } = await supabase.from("loans").select("*");
    const { data: savings } = await supabase.from("savings").select("*")
      .gte("week_start", dateRange.start.toISOString());

    const mainAccounts = accounts?.filter(a => a.account_type === 'main') || [];
    const subAccounts = accounts?.filter(a => a.account_type === 'sub') || [];

    const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    const totalSavingsAmount = accounts?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;

    const sumTxns = (type: string, status?: string) =>
      (allPeriodTxns || []).filter(t => t.transaction_type === type && (!status || t.status === status))
        .reduce((s, t) => s + Number(t.amount), 0);

    const totalDeposits = sumTxns("deposit", "approved");
    const totalWithdrawals = sumTxns("withdrawal", "approved");
    const totalRepayments = sumTxns("loan_repayment", "approved");
    const totalDisbursements = sumTxns("loan_disbursement", "approved");
    const totalInterestReceived = sumTxns("interest_received", "approved");

    const allTimeDeposits = (allTxns || []).filter(t => t.transaction_type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
    const allTimeWithdrawals = (allTxns || []).filter(t => t.transaction_type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);
    const allTimeRepayments = (allTxns || []).filter(t => t.transaction_type === "loan_repayment").reduce((s, t) => s + Number(t.amount), 0);
    const allTimeDisbursements = (allTxns || []).filter(t => t.transaction_type === "loan_disbursement").reduce((s, t) => s + Number(t.amount), 0);
    const allTimeInterest = (allTxns || []).filter(t => t.transaction_type === "interest_received").reduce((s, t) => s + Number(t.amount), 0);

    const activeLoans = (allLoans || []).filter(l => ["disbursed", "active"].includes(l.status) && l.outstanding_balance > 0);
    const overdueLoans = activeLoans.filter(l => isLoanOverdue(l));
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
    const totalEverDisbursed = (allLoans || []).filter(l => ["disbursed", "active", "completed", "fully_paid"].includes(l.status))
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalOverdueBalance = overdueLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
    const totalOverduePenalty = overdueLoans.reduce((sum, l) => sum + calcDailyOverdueInterest(l), 0);

    const getMemberName = (acc: any) => {
      if (acc.account_type === 'sub') {
        const sp = subProfiles?.find(p => p.account_id === acc.id);
        return sp?.full_name ? `${sp.full_name} (Sub)` : "Unknown (Sub)";
      }
      const pr = profiles?.find(p => p.id === acc.user_id);
      return pr?.full_name || "Unknown";
    };

    if (asPdf) {
      const membersData = (accounts || []).map(acc => {
        const memberActiveLoans = activeLoans.filter((l: any) => l.account_id === acc.id);
        const outstandingBalance = memberActiveLoans.reduce((s: number, l: any) => s + Number(l.outstanding_balance), 0);
        const overdueLoan = memberActiveLoans.find((l: any) => isLoanOverdue(l));
        return {
          name: getMemberName(acc),
          accountNumber: acc.account_number,
          accountType: acc.account_type,
          balance: Number(acc.balance),
          savings: Number(acc.total_savings),
          activeLoans: memberActiveLoans.length,
          outstandingBalance,
          isOverdue: !!overdueLoan,
          daysOverdue: overdueLoan ? getDaysOverdue(overdueLoan) : 0,
          overduePenalty: overdueLoan ? calcDailyOverdueInterest(overdueLoan) : 0,
        };
      });
      generateGroupReportPDF({
        totalMembers: profiles?.length || 0,
        totalBalance,
        totalSavings: totalSavingsAmount,
        totalOutstandingLoans: totalOutstanding,
        periodDeposits: totalDeposits,
        periodWithdrawals: totalWithdrawals,
        periodRepayments: totalRepayments,
        periodInterest: totalInterestReceived,
        pendingLoans: (allLoans || []).filter((l: any) => l.status === "pending").length,
        approvedLoans: (allLoans || []).filter((l: any) => l.status === "approved").length,
        disbursedLoans: (allLoans || []).filter((l: any) => ["disbursed", "active"].includes(l.status)).length,
        completedLoans: (allLoans || []).filter((l: any) => ["completed", "fully_paid"].includes(l.status)).length,
        members: membersData,
        dateRange,
        allTimeDeposits,
        allTimeWithdrawals,
        allTimeRepayments,
        allTimeDisbursements,
        allTimeInterest,
        overdueLoansCount: overdueLoans.length,
        totalOverdueBalance,
        totalOverduePenalty,
      });
      toast({ title: "Success", description: "PDF group report generated" });
      setLoading(false);
      return;
    }

    if (asExcel) {
      await generateGroupExcel({
        accounts, mainAccounts, subAccounts, profiles, subProfiles, allPeriodTxns, allTxns, allLoans, savings,
        activeLoans, overdueLoans, totalBalance, totalSavingsAmount, totalDeposits, totalWithdrawals,
        totalRepayments, totalDisbursements, totalInterestReceived, totalOutstanding, totalEverDisbursed,
        totalOverdueBalance, totalOverduePenalty, allTimeDeposits, allTimeWithdrawals, allTimeRepayments,
        allTimeDisbursements, allTimeInterest, dateRange, getMemberName,
      });
      setLoading(false);
      return;
    }

    // ── Text report ─────────────────────────────────────────────────
    const pendingApprovals = (allPeriodTxns || []).filter(t => t.status === "pending").length;

    let report = `KINONI SACCO - COMPREHENSIVE GROUP REPORT\n`;
    report += `${"═".repeat(75)}\n`;
    report += `Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}\n`;
    report += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

    report += `EXECUTIVE SUMMARY\n${"─".repeat(75)}\n`;
    report += `Total Members:                ${profiles?.length || 0}\n`;
    report += `Main Accounts:                ${mainAccounts.length}\n`;
    report += `Sub-Accounts:                 ${subAccounts.length}\n`;
    report += `Combined Balance:             UGX ${totalBalance.toLocaleString()}\n`;
    report += `Combined Total Savings:       UGX ${totalSavingsAmount.toLocaleString()}\n`;
    report += `Pending Transactions:         ${pendingApprovals}\n\n`;

    report += `ALL-TIME FINANCIAL TOTALS\n${"─".repeat(75)}\n`;
    report += `All Deposits:                 UGX ${allTimeDeposits.toLocaleString()}\n`;
    report += `All Withdrawals:              UGX ${allTimeWithdrawals.toLocaleString()}\n`;
    report += `Net Deposits (All-time):      UGX ${(allTimeDeposits - allTimeWithdrawals).toLocaleString()}\n`;
    report += `All Loan Disbursements:       UGX ${allTimeDisbursements.toLocaleString()}\n`;
    report += `All Loan Repayments:          UGX ${allTimeRepayments.toLocaleString()}\n`;
    report += `All Interest Received:        UGX ${allTimeInterest.toLocaleString()}\n\n`;

    report += `PERIOD FINANCIAL ACTIVITY (${format(dateRange.start, "MMM dd")} - ${format(dateRange.end, "MMM dd, yyyy")})\n${"─".repeat(75)}\n`;
    report += `Period Deposits:              UGX ${totalDeposits.toLocaleString()}\n`;
    report += `Period Withdrawals:           UGX ${totalWithdrawals.toLocaleString()}\n`;
    report += `Net Movement:                 UGX ${(totalDeposits - totalWithdrawals).toLocaleString()}\n`;
    report += `Period Disbursements:         UGX ${totalDisbursements.toLocaleString()}\n`;
    report += `Period Repayments:            UGX ${totalRepayments.toLocaleString()}\n`;
    report += `Period Interest Income:       UGX ${totalInterestReceived.toLocaleString()}\n`;
    report += `Period Savings Collected:     UGX ${(savings?.reduce((s, sv) => s + Number(sv.amount), 0) || 0).toLocaleString()}\n\n`;

    report += `LOAN PORTFOLIO SUMMARY\n${"─".repeat(75)}\n`;
    report += `Total Ever Disbursed:         UGX ${totalEverDisbursed.toLocaleString()}\n`;
    report += `Active Loans Count:           ${activeLoans.length}\n`;
    report += `Total Outstanding Balance:    UGX ${totalOutstanding.toLocaleString()}\n`;
    report += `Overdue Loans Count:          ${overdueLoans.length}\n`;
    report += `Total Overdue Balance:        UGX ${totalOverdueBalance.toLocaleString()}\n`;
    report += `Total Overdue Penalties:      UGX ${totalOverduePenalty.toLocaleString()}\n\n`;

    report += `LOAN STATUS BREAKDOWN\n${"─".repeat(75)}\n`;
    report += `Pending:                      ${(allLoans || []).filter(l => l.status === "pending").length}\n`;
    report += `Approved:                     ${(allLoans || []).filter(l => l.status === "approved").length}\n`;
    report += `Disbursed/Active:             ${activeLoans.length}\n`;
    report += `Completed/Fully Paid:         ${(allLoans || []).filter(l => ["completed", "fully_paid"].includes(l.status)).length}\n`;
    report += `Rejected:                     ${(allLoans || []).filter(l => l.status === "rejected").length}\n\n`;

    report += `DISBURSED LOANS PER MEMBER\n${"─".repeat(75)}\n`;
    activeLoans.forEach(l => {
      const acc = accounts?.find(a => a.id === l.account_id);
      const memberName = acc ? getMemberName(acc) : "Unknown";
      const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A";
      const amountRepaid = Number(l.total_amount) - Number(l.outstanding_balance);
      const overdue = isLoanOverdue(l);
      const days = getDaysOverdue(l);
      const penalty = calcDailyOverdueInterest(l);
      const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
      report += `${memberName.padEnd(30)} | Acc: ${acc?.account_number || "N/A"}\n`;
      report += `  Principal:   UGX ${Number(l.amount).toLocaleString().padStart(12)} | Disbursed: ${disbDate}\n`;
      report += `  Total Int.:  UGX ${totalInterest.toLocaleString().padStart(12)} | Rate: ${l.interest_rate}%/mo × ${l.repayment_months}mo\n`;
      report += `  Repaid:      UGX ${amountRepaid.toLocaleString().padStart(12)} | Outstanding: UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
      report += `  Status: ${overdue ? `⚠ OVERDUE (${days} days) | Penalty: UGX ${penalty.toLocaleString()}` : "Active"}\n\n`;
    });

    if (overdueLoans.length > 0) {
      report += `OVERDUE LOANS DETAIL\n${"─".repeat(75)}\n`;
      overdueLoans.forEach(l => {
        const acc = accounts?.find(a => a.id === l.account_id);
        const memberName = acc ? getMemberName(acc) : "Unknown";
        const days = getDaysOverdue(l);
        const penalty = calcDailyOverdueInterest(l);
        const dueDate = l.disbursed_at
          ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy") : "N/A";
        report += `Member:   ${memberName} (${acc?.account_number || "N/A"})\n`;
        report += `  Principal:             UGX ${Number(l.amount).toLocaleString()}\n`;
        report += `  Outstanding Balance:   UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
        report += `  Due Date:              ${dueDate}\n`;
        report += `  Days Overdue:          ${days}\n`;
        report += `  Daily Penalty Rate:    2% / 30 days\n`;
        report += `  Accrued Penalty:       UGX ${penalty.toLocaleString()}\n\n`;
      });
    }

    report += `MAIN ACCOUNTS BREAKDOWN\n${"─".repeat(75)}\n`;
    mainAccounts.forEach(acc => {
      const profile = profiles?.find(p => p.id === acc.user_id);
      const memberLoans = activeLoans.filter(l => l.account_id === acc.id);
      const totalMemberDisb = (allLoans || []).filter(l => l.account_id === acc.id && ["disbursed", "active", "completed", "fully_paid"].includes(l.status))
        .reduce((s, l) => s + Number(l.amount), 0);
      const totalMemberRepaid = (allTxns || []).filter(t => t.account_id === acc.id && t.transaction_type === "loan_repayment")
        .reduce((s, t) => s + Number(t.amount), 0);
      const totalMemberOutstanding = memberLoans.reduce((s, l) => s + Number(l.outstanding_balance), 0);
      const totalMemberInt = (allTxns || []).filter(t => t.account_id === acc.id && t.transaction_type === "interest_received")
        .reduce((s, t) => s + Number(t.amount), 0);
      report += `${(profile?.full_name || "Unknown").padEnd(30)} | ${acc.account_number}\n`;
      report += `  Balance: UGX ${Number(acc.balance).toLocaleString().padStart(12)} | Savings: UGX ${Number(acc.total_savings).toLocaleString()}\n`;
      report += `  Disbursed: UGX ${totalMemberDisb.toLocaleString().padStart(10)} | Repaid: UGX ${totalMemberRepaid.toLocaleString()}\n`;
      if (totalMemberInt > 0) report += `  Interest Paid: UGX ${totalMemberInt.toLocaleString()}\n`;
      if (totalMemberOutstanding > 0) report += `  Active Loan Outstanding: UGX ${totalMemberOutstanding.toLocaleString()}\n`;
      report += `\n`;
    });

    if (subAccounts.length > 0) {
      report += `SUB-ACCOUNTS BREAKDOWN\n${"─".repeat(75)}\n`;
      subAccounts.forEach(acc => {
        const subProfile = subProfiles?.find(p => p.account_id === acc.id);
        const memberLoans = activeLoans.filter(l => l.account_id === acc.id);
        const totalMemberOutstanding = memberLoans.reduce((s, l) => s + Number(l.outstanding_balance), 0);
        report += `${(subProfile?.full_name || "Unknown").padEnd(30)} | ${acc.account_number} (Sub)\n`;
        report += `  Balance: UGX ${Number(acc.balance).toLocaleString().padStart(12)} | Savings: UGX ${Number(acc.total_savings).toLocaleString()}\n`;
        if (totalMemberOutstanding > 0) report += `  Active Loan Outstanding: UGX ${totalMemberOutstanding.toLocaleString()}\n`;
        report += `\n`;
      });
    }

    report += `${"═".repeat(75)}\nEnd of Report - KINONI SACCO Management System\n`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinoni_group_report_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Group report generated" });
    setLoading(false);
  };

  // ─── GROUP EXCEL EXPORT ───────────────────────────────────────────
  const generateGroupExcel = async (ctx: any) => {
    const {
      accounts, mainAccounts, subAccounts, profiles, subProfiles, allPeriodTxns, allTxns, allLoans, savings,
      activeLoans, overdueLoans, totalBalance, totalSavingsAmount, totalDeposits, totalWithdrawals,
      totalRepayments, totalDisbursements, totalInterestReceived, totalOutstanding, totalEverDisbursed,
      totalOverdueBalance, totalOverduePenalty, allTimeDeposits, allTimeWithdrawals, allTimeRepayments,
      allTimeDisbursements, allTimeInterest, dateRange, getMemberName,
    } = ctx;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ["KINONI SACCO - GROUP REPORT"],
      [`Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`],
      [`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`],
      [],
      ["EXECUTIVE SUMMARY"],
      ["Total Members", profiles?.length || 0],
      ["Main Accounts", mainAccounts.length],
      ["Sub-Accounts", subAccounts.length],
      ["Combined Balance (UGX)", totalBalance],
      ["Combined Savings (UGX)", totalSavingsAmount],
      [],
      ["ALL-TIME TOTALS"],
      ["All Deposits (UGX)", allTimeDeposits],
      ["All Withdrawals (UGX)", allTimeWithdrawals],
      ["Net Deposits (UGX)", allTimeDeposits - allTimeWithdrawals],
      ["All Disbursements (UGX)", allTimeDisbursements],
      ["All Repayments (UGX)", allTimeRepayments],
      ["All Interest Received (UGX)", allTimeInterest],
      [],
      ["PERIOD ACTIVITY"],
      ["Period Deposits (UGX)", totalDeposits],
      ["Period Withdrawals (UGX)", totalWithdrawals],
      ["Period Disbursements (UGX)", totalDisbursements],
      ["Period Repayments (UGX)", totalRepayments],
      ["Period Interest (UGX)", totalInterestReceived],
      ["Period Savings (UGX)", (savings || []).reduce((s: number, sv: any) => s + Number(sv.amount), 0)],
      [],
      ["LOAN PORTFOLIO"],
      ["Total Ever Disbursed (UGX)", totalEverDisbursed],
      ["Active Loans Count", activeLoans.length],
      ["Total Outstanding (UGX)", totalOutstanding],
      ["Overdue Loans Count", overdueLoans.length],
      ["Total Overdue Balance (UGX)", totalOverdueBalance],
      ["Total Overdue Penalties (UGX)", totalOverduePenalty],
      [],
      ["LOAN STATUS BREAKDOWN"],
      ["Pending", (allLoans || []).filter((l: any) => l.status === "pending").length],
      ["Approved", (allLoans || []).filter((l: any) => l.status === "approved").length],
      ["Disbursed/Active", activeLoans.length],
      ["Completed/Paid", (allLoans || []).filter((l: any) => ["completed", "fully_paid"].includes(l.status)).length],
      ["Rejected", (allLoans || []).filter((l: any) => l.status === "rejected").length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    // Sheet 2: Members Breakdown
    const memberHeaders = ["Member Name", "Account Number", "Type", "Balance (UGX)", "Total Savings (UGX)", "All Disbursements (UGX)", "All Repayments (UGX)", "Interest Paid (UGX)", "Outstanding Loans (UGX)"];
    const memberRows = (accounts || []).map((acc: any) => {
      const name = getMemberName(acc);
      const memberLoans = activeLoans.filter((l: any) => l.account_id === acc.id);
      const outstanding = memberLoans.reduce((s: number, l: any) => s + Number(l.outstanding_balance), 0);
      const disbursed = (allLoans || []).filter((l: any) => l.account_id === acc.id && ["disbursed","active","completed","fully_paid"].includes(l.status))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      const repaid = (allTxns || []).filter((t: any) => t.account_id === acc.id && t.transaction_type === "loan_repayment")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const interest = (allTxns || []).filter((t: any) => t.account_id === acc.id && t.transaction_type === "interest_received")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      return [name, acc.account_number, acc.account_type, Number(acc.balance), Number(acc.total_savings), disbursed, repaid, interest, outstanding];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([memberHeaders, ...memberRows]), "Members");

    // Sheet 3: Active Loans
    const activeLoanHeaders = ["Member Name", "Account Number", "Principal (UGX)", "Interest Rate", "Months", "Total Interest (UGX)", "Total Payable (UGX)", "Repaid (UGX)", "Outstanding (UGX)", "Disbursed On", "Due Date", "Days Overdue", "Overdue Penalty (UGX)"];
    const activeLoanRows = activeLoans.map((l: any) => {
      const acc = accounts?.find((a: any) => a.id === l.account_id);
      const name = acc ? getMemberName(acc) : "Unknown";
      const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A";
      const dueDate = l.disbursed_at && l.repayment_months
        ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy") : "N/A";
      const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
      const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
      const days = getDaysOverdue(l);
      const penalty = calcDailyOverdueInterest(l);
      return [name, acc?.account_number || "N/A", Number(l.amount), `${l.interest_rate}%`, l.repayment_months, totalInterest, Number(l.total_amount), repaid, Number(l.outstanding_balance), disbDate, dueDate, days, penalty];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([activeLoanHeaders, ...activeLoanRows]), "Active Loans");

    // Sheet 4: All Transactions (Period)
    const txnHeaders = ["Date", "Member", "Account No", "TXN ID", "Type", "Amount (UGX)", "Balance After (UGX)", "Status", "Description"];
    const txnRows = (allPeriodTxns || []).map((t: any) => {
      const acc = accounts?.find((a: any) => a.id === t.account_id);
      const name = acc ? getMemberName(acc) : "Unknown";
      return [
        format(new Date(t.created_at), "MMM dd, yyyy HH:mm"),
        name, acc?.account_number || "N/A", t.tnx_id,
        t.transaction_type.replace(/_/g, " ").toUpperCase(),
        Number(t.amount), Number(t.balance_after),
        (t.status || "").toUpperCase(), t.description || "",
      ];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([txnHeaders, ...txnRows]), "Period Transactions");

    XLSX.writeFile(wb, `kinoni_group_report_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast({ title: "Success", description: "Excel group report downloaded" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Report Period</Label>
          <Select value={reportPeriod} onValueChange={setReportPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="last">Last Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
              <SelectItem value="year">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant={showCharts ? "default" : "outline"} onClick={() => setShowCharts(!showCharts)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          {showCharts ? "Hide Charts" : "Show Charts"}
        </Button>
      </div>

      {showCharts && chartData && (
        <FinancialCharts
          transactionData={chartData.transactionData}
          loanData={chartData.loanData}
          savingsData={chartData.savingsData}
          balanceData={chartData.balanceData}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Member Report
            </CardTitle>
            <CardDescription>Detailed report with all transactions, loans & savings for a specific member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Member</Label>
              <Select
                value={selectedMember}
                onValueChange={setSelectedMember}
                onOpenChange={(open) => { if (open && members.length === 0) loadMembers(); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name} - {member.accounts?.[0]?.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => generateMemberReport(false, false)} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
                Text
              </Button>
              <Button onClick={() => generateMemberReport(true, false)} variant="outline" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
                PDF
              </Button>
              <Button onClick={() => generateMemberReport(false, true)} variant="secondary" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <TableIcon className="mr-1 h-4 w-4" />}
                Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Group Report
            </CardTitle>
            <CardDescription>Comprehensive SACCO report with all financial data and loan portfolio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Report includes:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>All-time & period transaction totals by type</li>
                <li>Disbursed loans per member with interest breakdown</li>
                <li>Overdue loans with daily penalty accrual</li>
                <li>Per-member balance, savings, disbursements & repayments</li>
                <li>Collective outstanding balances & collective totals</li>
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => generateGroupReport(false, false)} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wallet className="mr-1 h-4 w-4" />}
                Text
              </Button>
              <Button onClick={() => generateGroupReport(true, false)} variant="outline" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
                PDF
              </Button>
              <Button onClick={() => generateGroupReport(false, true)} variant="secondary" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <TableIcon className="mr-1 h-4 w-4" />}
                Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsGeneration;
