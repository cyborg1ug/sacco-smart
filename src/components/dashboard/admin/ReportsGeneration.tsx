import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, TrendingUp, Users, Wallet } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const ReportsGeneration = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [reportPeriod, setReportPeriod] = useState("current");

  const loadMembers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        accounts (
          id,
          account_number
        )
      `);

    if (data) {
      setMembers(data);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    if (reportPeriod === "current") {
      return { start: startOfMonth(now), end: now };
    } else if (reportPeriod === "last") {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    } else if (reportPeriod === "quarter") {
      return { start: subMonths(now, 3), end: now };
    }
    return { start: subMonths(now, 12), end: now };
  };

  const generateMemberReport = async () => {
    if (!selectedMember) {
      toast({
        title: "Error",
        description: "Please select a member",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const dateRange = getDateRange();

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        full_name,
        email,
        phone_number,
        occupation,
        accounts!inner (
          id,
          account_number,
          balance,
          total_savings
        )
      `)
      .eq("id", selectedMember)
      .single() as { data: any };

    if (!profile) {
      toast({
        title: "Error",
        description: "Member not found",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", profile.accounts[0].id)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString())
      .order("created_at", { ascending: false });

    const { data: savings } = await supabase
      .from("savings")
      .select("*")
      .eq("account_id", profile.accounts[0].id)
      .gte("week_start", dateRange.start.toISOString())
      .lte("week_end", dateRange.end.toISOString());

    const { data: loans } = await supabase
      .from("loans")
      .select("*")
      .eq("account_id", profile.accounts[0].id);

    const totalDeposits = transactions?.filter(t => t.transaction_type === "deposit" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalWithdrawals = transactions?.filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalSavings = savings?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

    let report = `KINONI SACCO - MEMBER REPORT\n`;
    report += `${"═".repeat(70)}\n`;
    report += `Report Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}\n`;
    report += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

    report += `MEMBER INFORMATION\n`;
    report += `${"─".repeat(70)}\n`;
    report += `Name: ${profile.full_name}\n`;
    report += `Email: ${profile.email}\n`;
    report += `Phone: ${profile.phone_number || "N/A"}\n`;
    report += `Occupation: ${profile.occupation || "N/A"}\n`;
    report += `Account Number: ${profile.accounts[0].account_number}\n\n`;

    report += `FINANCIAL SUMMARY\n`;
    report += `${"─".repeat(70)}\n`;
    report += `Current Balance: UGX ${Number(profile.accounts[0].balance).toLocaleString()}\n`;
    report += `Total Savings: UGX ${Number(profile.accounts[0].total_savings).toLocaleString()}\n`;
    report += `Period Deposits: UGX ${totalDeposits.toLocaleString()}\n`;
    report += `Period Withdrawals: UGX ${totalWithdrawals.toLocaleString()}\n`;
    report += `Period Savings: UGX ${totalSavings.toLocaleString()}\n\n`;

    report += `TRANSACTION DETAILS\n`;
    report += `${"─".repeat(70)}\n`;
    if (transactions && transactions.length > 0) {
      transactions.forEach(t => {
        report += `${format(new Date(t.created_at), "MMM dd, yyyy HH:mm")} | `;
        report += `${t.transaction_type.toUpperCase().padEnd(12)} | `;
        report += `UGX ${Number(t.amount).toLocaleString().padStart(12)} | `;
        report += `${t.status.toUpperCase()}\n`;
      });
    } else {
      report += `No transactions in this period.\n`;
    }

    report += `\nLOAN STATUS\n`;
    report += `${"─".repeat(70)}\n`;
    if (loans && loans.length > 0) {
      loans.forEach(l => {
        report += `Loan Amount: UGX ${Number(l.amount).toLocaleString()}\n`;
        report += `Interest Rate: ${l.interest_rate}%\n`;
        report += `Total Payable: UGX ${Number(l.total_amount).toLocaleString()}\n`;
        report += `Outstanding: UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
        report += `Status: ${l.status.toUpperCase()}\n\n`;
      });
    } else {
      report += `No loans on record.\n`;
    }

    report += `\n${"═".repeat(70)}\n`;
    report += `End of Report - KINONI SACCO Management System\n`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinoni_member_report_${profile.accounts[0].account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Member report generated successfully",
    });

    setLoading(false);
  };

  const generateGroupReport = async () => {
    setLoading(true);
    const dateRange = getDateRange();

    const { data: accounts } = await supabase.from("accounts").select("*");
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());
    const { data: loans } = await supabase.from("loans").select("*");
    const { data: savings } = await supabase
      .from("savings")
      .select("*")
      .gte("week_start", dateRange.start.toISOString());

    const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    const totalSavingsAmount = accounts?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;
    const totalDeposits = transactions?.filter(t => t.transaction_type === "deposit" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalWithdrawals = transactions?.filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const activeLoans = loans?.filter(l => l.status === "disbursed") || [];
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
    const pendingApprovals = transactions?.filter(t => t.status === "pending").length || 0;

    let report = `KINONI SACCO - GROUP REPORT\n`;
    report += `${"═".repeat(70)}\n`;
    report += `Report Period: ${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}\n`;
    report += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

    report += `EXECUTIVE SUMMARY\n`;
    report += `${"─".repeat(70)}\n`;
    report += `Total Members: ${profiles?.length || 0}\n`;
    report += `Total Accounts: ${accounts?.length || 0}\n`;
    report += `Combined Balance: UGX ${totalBalance.toLocaleString()}\n`;
    report += `Combined Savings: UGX ${totalSavingsAmount.toLocaleString()}\n`;
    report += `Active Loans: ${activeLoans.length}\n`;
    report += `Outstanding Loan Amount: UGX ${totalOutstanding.toLocaleString()}\n`;
    report += `Pending Transactions: ${pendingApprovals}\n\n`;

    report += `PERIOD ACTIVITY\n`;
    report += `${"─".repeat(70)}\n`;
    report += `Total Deposits: UGX ${totalDeposits.toLocaleString()}\n`;
    report += `Total Withdrawals: UGX ${totalWithdrawals.toLocaleString()}\n`;
    report += `Net Movement: UGX ${(totalDeposits - totalWithdrawals).toLocaleString()}\n`;
    report += `Savings Collected: UGX ${savings?.reduce((s, sv) => s + Number(sv.amount), 0).toLocaleString()}\n\n`;

    report += `LOAN PORTFOLIO\n`;
    report += `${"─".repeat(70)}\n`;
    report += `Pending Loans: ${loans?.filter(l => l.status === "pending").length || 0}\n`;
    report += `Approved Loans: ${loans?.filter(l => l.status === "approved").length || 0}\n`;
    report += `Disbursed Loans: ${loans?.filter(l => l.status === "disbursed").length || 0}\n`;
    report += `Completed Loans: ${loans?.filter(l => l.status === "completed").length || 0}\n`;
    report += `Rejected Loans: ${loans?.filter(l => l.status === "rejected").length || 0}\n\n`;

    report += `MEMBER BREAKDOWN\n`;
    report += `${"─".repeat(70)}\n`;
    accounts?.forEach(acc => {
      const profile = profiles?.find(p => p.id === acc.user_id);
      report += `${(profile?.full_name || "Unknown").padEnd(30)} | `;
      report += `${acc.account_number} | `;
      report += `Balance: UGX ${Number(acc.balance).toLocaleString().padStart(12)}\n`;
    });

    report += `\n${"═".repeat(70)}\n`;
    report += `End of Report - KINONI SACCO Management System\n`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinoni_group_report_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Group report generated successfully",
    });

    setLoading(false);
  };

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Member Report
            </CardTitle>
            <CardDescription>Generate detailed report for a specific member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Member</Label>
              <Select 
                value={selectedMember} 
                onValueChange={setSelectedMember}
                onOpenChange={(open) => {
                  if (open && members.length === 0) {
                    loadMembers();
                  }
                }}
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
            <Button onClick={generateMemberReport} className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-2 h-4 w-4" />
              Generate Member Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Group Report
            </CardTitle>
            <CardDescription>Generate consolidated report for the entire SACCO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Report includes:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>Executive summary</li>
                <li>Period activity</li>
                <li>Loan portfolio status</li>
                <li>Member breakdown</li>
              </ul>
            </div>
            <Button onClick={generateGroupReport} className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Wallet className="mr-2 h-4 w-4" />
              Generate Group Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsGeneration;
