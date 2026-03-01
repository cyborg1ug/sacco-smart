import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, TrendingUp, Users, Wallet, FileDown, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, differenceInMonths } from "date-fns";
import FinancialCharts from "../charts/FinancialCharts";
import { generateMemberStatementPDF, generateGroupReportPDF } from "@/lib/pdfGenerator";

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
    if (showCharts) {
      loadChartData();
    }
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

  const generateMemberReport = async (asPdf = false) => {
    if (!selectedMember) {
      toast({ title: "Error", description: "Please select a member", variant: "destructive" });
      return;
    }
    setLoading(true);
    const dateRange = getDateRange();

    const { data: profile } = await supabase
      .from("profiles")
      .select(`full_name, email, phone_number, occupation, accounts!inner (id, account_number, balance, total_savings)`)
      .eq("id", selectedMember).single() as { data: any };

    if (!profile) {
      toast({ title: "Error", description: "Member not found", variant: "destructive" });
      setLoading(false);
      return;
    }

    const accountId = profile.accounts[0].id;
    const { data: transactions } = await supabase.from("transactions").select("*")
      .eq("account_id", accountId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString())
      .order("created_at", { ascending: false });

    const { data: savings } = await supabase.from("savings").select("*")
      .eq("account_id", accountId)
      .gte("week_start", dateRange.start.toISOString())
      .lte("week_end", dateRange.end.toISOString());

    // Get ALL loans for this member (not just period)
    const { data: loans } = await supabase.from("loans").select("*").eq("account_id", accountId);

    if (asPdf) {
      generateMemberStatementPDF({
        memberName: profile.full_name,
        email: profile.email,
        phoneNumber: profile.phone_number,
        accountNumber: profile.accounts[0].account_number,
        balance: Number(profile.accounts[0].balance),
        totalSavings: Number(profile.accounts[0].total_savings),
        transactions: transactions || [],
        loans: loans || [],
        savings: savings || [],
      });
      toast({ title: "Success", description: "PDF report generated successfully" });
    } else {
      const totalDeposits = transactions?.filter(t => t.transaction_type === "deposit" && t.status === "approved")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalWithdrawals = transactions?.filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalRepayments = transactions?.filter(t => t.transaction_type === "loan_repayment" && t.status === "approved")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalSavings = savings?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

      const activeLoans = loans?.filter(l => ["disbursed", "active"].includes(l.status) && l.outstanding_balance > 0) || [];
      const completedLoans = loans?.filter(l => ["completed", "fully_paid"].includes(l.status)) || [];
      const overdueLoans = activeLoans.filter(l => isLoanOverdue(l));

      let report = `KINONI SACCO - MEMBER REPORT\n`;
      report += `${"═".repeat(70)}\n`;
      report += `Report Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}\n`;
      report += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

      report += `MEMBER INFORMATION\n${"─".repeat(70)}\n`;
      report += `Name: ${profile.full_name}\nEmail: ${profile.email}\n`;
      report += `Phone: ${profile.phone_number || "N/A"}\nOccupation: ${profile.occupation || "N/A"}\n`;
      report += `Account Number: ${profile.accounts[0].account_number}\n\n`;

      report += `FINANCIAL SUMMARY\n${"─".repeat(70)}\n`;
      report += `Current Balance:        UGX ${Number(profile.accounts[0].balance).toLocaleString()}\n`;
      report += `Total Savings:          UGX ${Number(profile.accounts[0].total_savings).toLocaleString()}\n`;
      report += `Period Deposits:        UGX ${totalDeposits.toLocaleString()}\n`;
      report += `Period Withdrawals:     UGX ${totalWithdrawals.toLocaleString()}\n`;
      report += `Period Savings:         UGX ${totalSavings.toLocaleString()}\n`;
      report += `Period Loan Repayments: UGX ${totalRepayments.toLocaleString()}\n\n`;

      // Active Loans Section
      if (activeLoans.length > 0) {
        report += `ACTIVE LOANS\n${"─".repeat(70)}\n`;
        activeLoans.forEach((l, i) => {
          const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A";
          const monthsElapsed = l.disbursed_at ? differenceInMonths(new Date(), new Date(l.disbursed_at)) : 0;
          const isOverdue = isLoanOverdue(l);
          report += `Loan ${i + 1}:\n`;
          report += `  Principal:           UGX ${Number(l.amount).toLocaleString()}\n`;
          report += `  Interest Rate:       ${l.interest_rate}% per month\n`;
          report += `  Repayment Months:    ${l.repayment_months}\n`;
          report += `  Total Payable:       UGX ${Number(l.total_amount).toLocaleString()}\n`;
          report += `  Outstanding Balance: UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
          report += `  Amount Repaid:       UGX ${(Number(l.total_amount) - Number(l.outstanding_balance)).toLocaleString()}\n`;
          report += `  Disbursed On:        ${disbDate}\n`;
          report += `  Status:              ${isOverdue ? "⚠ OVERDUE" : "Active"}\n`;
          if (isOverdue) {
            report += `  Months Overdue:      ${monthsElapsed - l.repayment_months}\n`;
          }
          report += `\n`;
        });
      }

      // Overdue loans
      if (overdueLoans.length > 0) {
        report += `OVERDUE LOAN DETAILS\n${"─".repeat(70)}\n`;
        report += `WARNING: The following loans are past their repayment period:\n\n`;
        overdueLoans.forEach(l => {
          const monthsElapsed = differenceInMonths(new Date(), new Date(l.disbursed_at));
          const overdueMonths = monthsElapsed - l.repayment_months;
          const penaltyAmount = Number(l.amount) * 0.02 * overdueMonths;
          report += `  Outstanding Balance: UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
          report += `  Months Overdue: ${overdueMonths}\n`;
          report += `  Estimated Penalty (2%/month): UGX ${penaltyAmount.toLocaleString()}\n\n`;
        });
      }

      // Completed loans
      if (completedLoans.length > 0) {
        report += `COMPLETED LOANS\n${"─".repeat(70)}\n`;
        completedLoans.forEach(l => {
          report += `  Principal: UGX ${Number(l.amount).toLocaleString()} | Status: ${l.status.toUpperCase()}\n`;
        });
        report += `\n`;
      }

      report += `TRANSACTION HISTORY (Period)\n${"─".repeat(70)}\n`;
      if (transactions && transactions.length > 0) {
        transactions.filter(t => t.status === "approved").forEach(t => {
          report += `${format(new Date(t.created_at), "MMM dd, yyyy HH:mm")} | `;
          report += `${t.transaction_type.toUpperCase().padEnd(18)} | `;
          report += `UGX ${Number(t.amount).toLocaleString().padStart(12)} | `;
          report += `${t.status.toUpperCase()}\n`;
        });
      } else {
        report += `No transactions in this period.\n`;
      }

      report += `\n${"═".repeat(70)}\nEnd of Report - KINONI SACCO Management System\n`;

      const blob = new Blob([report], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinoni_member_report_${profile.accounts[0].account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Member report generated successfully" });
    }
    setLoading(false);
  };

  const generateGroupReport = async (asPdf = false) => {
    setLoading(true);
    const dateRange = getDateRange();

    const { data: accounts } = await supabase.from("accounts").select("*");
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: subProfiles } = await supabase.from("sub_account_profiles").select("*");
    const { data: transactions } = await supabase.from("transactions").select("*")
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());
    const { data: allLoans } = await supabase.from("loans").select("*");
    const { data: savings } = await supabase.from("savings").select("*")
      .gte("week_start", dateRange.start.toISOString());

    const mainAccounts = accounts?.filter(a => a.account_type === 'main') || [];
    const subAccounts = accounts?.filter(a => a.account_type === 'sub') || [];

    const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    const totalSavingsAmount = accounts?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;
    const totalDeposits = transactions?.filter(t => t.transaction_type === "deposit" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalWithdrawals = transactions?.filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalRepayments = transactions?.filter(t => t.transaction_type === "loan_repayment" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalInterestReceived = transactions?.filter(t => t.transaction_type === "interest_received" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const activeLoans = allLoans?.filter(l => ["disbursed", "active"].includes(l.status) && l.outstanding_balance > 0) || [];
    const overdueLoans = activeLoans.filter(l => isLoanOverdue(l));
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
    const totalDisbursed = allLoans?.filter(l => ["disbursed", "active", "completed", "fully_paid"].includes(l.status))
      .reduce((sum, l) => sum + Number(l.amount), 0) || 0;
    const totalOverdueBalance = overdueLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);

    if (asPdf) {
      const membersData = accounts?.map((acc) => {
        let name = "Unknown";
        if (acc.account_type === 'sub') {
          const subProfile = subProfiles?.find(p => p.account_id === acc.id);
          name = subProfile?.full_name ? `${subProfile.full_name} (Sub)` : "Unknown (Sub)";
        } else {
          const profile = profiles?.find((p) => p.id === acc.user_id);
          name = profile?.full_name || "Unknown";
        }
        return { name, accountNumber: acc.account_number, balance: Number(acc.balance), savings: Number(acc.total_savings) };
      }) || [];

      generateGroupReportPDF({
        totalMembers: profiles?.length || 0,
        totalBalance,
        totalSavings: totalSavingsAmount,
        totalOutstandingLoans: totalOutstanding,
        periodDeposits: totalDeposits,
        periodWithdrawals: totalWithdrawals,
        pendingLoans: allLoans?.filter(l => l.status === "pending").length || 0,
        approvedLoans: allLoans?.filter(l => l.status === "approved").length || 0,
        disbursedLoans: allLoans?.filter(l => l.status === "disbursed").length || 0,
        completedLoans: allLoans?.filter(l => ["completed", "fully_paid"].includes(l.status)).length || 0,
        members: membersData,
        dateRange,
      });
      toast({ title: "Success", description: "PDF report generated successfully" });
    } else {
      const pendingApprovals = transactions?.filter(t => t.status === "pending").length || 0;

      let report = `KINONI SACCO - COMPREHENSIVE GROUP REPORT\n`;
      report += `${"═".repeat(70)}\n`;
      report += `Report Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}\n`;
      report += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

      report += `EXECUTIVE SUMMARY\n${"─".repeat(70)}\n`;
      report += `Total Members:              ${profiles?.length || 0}\n`;
      report += `Main Accounts:              ${mainAccounts.length}\n`;
      report += `Sub-Accounts:               ${subAccounts.length}\n`;
      report += `Total Accounts:             ${accounts?.length || 0}\n`;
      report += `Combined Balance:           UGX ${totalBalance.toLocaleString()}\n`;
      report += `Combined Savings (Total):   UGX ${totalSavingsAmount.toLocaleString()}\n`;
      report += `Pending Transactions:       ${pendingApprovals}\n\n`;

      report += `PERIOD FINANCIAL ACTIVITY\n${"─".repeat(70)}\n`;
      report += `Total Deposits:             UGX ${totalDeposits.toLocaleString()}\n`;
      report += `Total Withdrawals:          UGX ${totalWithdrawals.toLocaleString()}\n`;
      report += `Net Movement:               UGX ${(totalDeposits - totalWithdrawals).toLocaleString()}\n`;
      report += `Savings Collected:          UGX ${(savings?.reduce((s, sv) => s + Number(sv.amount), 0) || 0).toLocaleString()}\n`;
      report += `Loan Repayments Received:   UGX ${totalRepayments.toLocaleString()}\n`;
      report += `Interest Income:            UGX ${totalInterestReceived.toLocaleString()}\n\n`;

      report += `LOAN PORTFOLIO SUMMARY\n${"─".repeat(70)}\n`;
      report += `Total Ever Disbursed:       UGX ${totalDisbursed.toLocaleString()}\n`;
      report += `Active Loans:               ${activeLoans.length}\n`;
      report += `Total Outstanding Balance:  UGX ${totalOutstanding.toLocaleString()}\n`;
      report += `Overdue Loans:              ${overdueLoans.length}\n`;
      report += `Total Overdue Balance:      UGX ${totalOverdueBalance.toLocaleString()}\n\n`;

      report += `LOAN STATUS BREAKDOWN\n${"─".repeat(70)}\n`;
      report += `Pending Loans:              ${allLoans?.filter(l => l.status === "pending").length || 0}\n`;
      report += `Approved Loans:             ${allLoans?.filter(l => l.status === "approved").length || 0}\n`;
      report += `Disbursed (Active) Loans:   ${activeLoans.length}\n`;
      report += `Completed/Fully Paid Loans: ${allLoans?.filter(l => ["completed","fully_paid"].includes(l.status)).length || 0}\n`;
      report += `Rejected Loans:             ${allLoans?.filter(l => l.status === "rejected").length || 0}\n\n`;

      // Per-member loan details
      report += `DISBURSED LOANS PER MEMBER\n${"─".repeat(70)}\n`;
      activeLoans.forEach(l => {
        const acc = accounts?.find(a => a.id === l.account_id);
        let memberName = "Unknown";
        if (acc) {
          if (acc.account_type === 'sub') {
            const sp = subProfiles?.find(p => p.account_id === acc.id);
            memberName = sp?.full_name || "Unknown (Sub)";
          } else {
            const pr = profiles?.find(p => p.id === acc.user_id);
            memberName = pr?.full_name || "Unknown";
          }
        }
        const disbDate = l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A";
        const amountRepaid = Number(l.total_amount) - Number(l.outstanding_balance);
        const overdue = isLoanOverdue(l);
        report += `${memberName.padEnd(28)} | Acc: ${acc?.account_number || "N/A"}\n`;
        report += `  Disbursed: UGX ${Number(l.amount).toLocaleString().padStart(12)} | Date: ${disbDate}\n`;
        report += `  Repaid:    UGX ${amountRepaid.toLocaleString().padStart(12)} | Outstanding: UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
        report += `  Status: ${overdue ? "⚠ OVERDUE" : "Active"}\n\n`;
      });

      // Overdue loans section
      if (overdueLoans.length > 0) {
        report += `OVERDUE LOANS DETAIL\n${"─".repeat(70)}\n`;
        report += `WARNING: The following loans are past their repayment period:\n\n`;
        overdueLoans.forEach(l => {
          const acc = accounts?.find(a => a.id === l.account_id);
          let memberName = "Unknown";
          if (acc) {
            if (acc.account_type === 'sub') {
              const sp = subProfiles?.find(p => p.account_id === acc.id);
              memberName = sp?.full_name || "Unknown (Sub)";
            } else {
              const pr = profiles?.find(p => p.id === acc.user_id);
              memberName = pr?.full_name || "Unknown";
            }
          }
          const monthsElapsed = differenceInMonths(new Date(), new Date(l.disbursed_at));
          const overdueMonths = monthsElapsed - l.repayment_months;
          const penaltyRate = 0.02;
          const penalty = Number(l.amount) * penaltyRate * overdueMonths;
          report += `Member: ${memberName} (${acc?.account_number || "N/A"})\n`;
          report += `  Original Amount: UGX ${Number(l.amount).toLocaleString()}\n`;
          report += `  Outstanding:     UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
          report += `  Due Date:        ${l.disbursed_at ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy") : "N/A"}\n`;
          report += `  Months Overdue:  ${overdueMonths}\n`;
          report += `  Penalty (2%/mo): UGX ${penalty.toLocaleString()}\n\n`;
        });
      }

      report += `MAIN ACCOUNTS BREAKDOWN\n${"─".repeat(70)}\n`;
      mainAccounts.forEach(acc => {
        const profile = profiles?.find(p => p.id === acc.user_id);
        const memberLoans = activeLoans.filter(l => l.account_id === acc.id);
        const totalMemberOutstanding = memberLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
        report += `${(profile?.full_name || "Unknown").padEnd(28)} | ${acc.account_number}\n`;
        report += `  Balance: UGX ${Number(acc.balance).toLocaleString().padStart(12)} | Savings: UGX ${Number(acc.total_savings).toLocaleString()}\n`;
        if (totalMemberOutstanding > 0) {
          report += `  Active Loan Outstanding: UGX ${totalMemberOutstanding.toLocaleString()}\n`;
        }
        report += `\n`;
      });

      if (subAccounts.length > 0) {
        report += `SUB-ACCOUNTS BREAKDOWN\n${"─".repeat(70)}\n`;
        subAccounts.forEach(acc => {
          const subProfile = subProfiles?.find(p => p.account_id === acc.id);
          const memberLoans = activeLoans.filter(l => l.account_id === acc.id);
          const totalMemberOutstanding = memberLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
          report += `${(subProfile?.full_name || "Unknown").padEnd(28)} | ${acc.account_number} (Sub)\n`;
          report += `  Balance: UGX ${Number(acc.balance).toLocaleString().padStart(12)} | Savings: UGX ${Number(acc.total_savings).toLocaleString()}\n`;
          if (totalMemberOutstanding > 0) {
            report += `  Active Loan Outstanding: UGX ${totalMemberOutstanding.toLocaleString()}\n`;
          }
          report += `\n`;
        });
      }

      report += `${"═".repeat(70)}\nEnd of Report - KINONI SACCO Management System\n`;

      const blob = new Blob([report], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinoni_group_report_${format(new Date(), "yyyyMMdd")}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Group report generated successfully" });
    }
    setLoading(false);
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
            <CardDescription>Generate detailed report for a specific member including loans, savings & transactions</CardDescription>
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
            <div className="flex gap-2">
              <Button onClick={() => generateMemberReport(false)} className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileText className="mr-2 h-4 w-4" />
                Text Report
              </Button>
              <Button onClick={() => generateMemberReport(true)} variant="outline" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileDown className="mr-2 h-4 w-4" />
                PDF Report
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
            <CardDescription>Consolidated SACCO report with full loan, savings & overdue details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Report includes:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Executive summary & period activity</li>
                <li>Disbursed loans per member</li>
                <li>Repaid amounts & outstanding balances</li>
                <li>Overdue loans with penalty estimates</li>
                <li>Collective loan portfolio totals</li>
                <li>Full member/sub-account breakdown</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => generateGroupReport(false)} className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Wallet className="mr-2 h-4 w-4" />
                Text Report
              </Button>
              <Button onClick={() => generateGroupReport(true)} variant="outline" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileDown className="mr-2 h-4 w-4" />
                PDF Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsGeneration;
