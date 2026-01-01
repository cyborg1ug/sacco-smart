import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";

const StatementsGeneration = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");

  const loadMembers = async () => {
    // Fetch all accounts first
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id");

    if (accountsData && accountsData.length > 0) {
      const userIds = [...new Set(accountsData.map(a => a.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const accountsMap = new Map<string, any[]>();
      accountsData.forEach(acc => {
        if (!accountsMap.has(acc.user_id)) {
          accountsMap.set(acc.user_id, []);
        }
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

  const generateMemberStatement = async () => {
    if (!selectedMember) {
      toast({
        title: "Error",
        description: "Please select a member",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone_number")
      .eq("id", selectedMember)
      .single();

    if (!profile) {
      toast({
        title: "Error",
        description: "Member not found",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Get account
    const { data: account } = await supabase
      .from("accounts")
      .select("id, account_number, balance, total_savings")
      .eq("user_id", selectedMember)
      .eq("account_type", "main")
      .maybeSingle();

    if (!account) {
      toast({
        title: "Error",
        description: "Account not found",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Get transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false });

    // Get loans
    const { data: loans } = await supabase
      .from("loans")
      .select("*")
      .eq("account_id", account.id);

    // Get savings
    const { data: savings } = await supabase
      .from("savings")
      .select("*")
      .eq("account_id", account.id)
      .order("week_start", { ascending: false });

    // Get welfare
    const { data: welfare } = await supabase
      .from("welfare")
      .select("*")
      .eq("account_id", account.id)
      .order("week_date", { ascending: false });

    // Calculate summaries
    const totalDeposits = transactions?.filter(t => t.transaction_type === "deposit" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalWithdrawals = transactions?.filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalLoanRepayments = transactions?.filter(t => t.transaction_type === "loan_repayment" && t.status === "approved")
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalWelfare = welfare?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
    const totalSavingsContributed = savings?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

    // Generate statement text
    let statement = `KINONI SACCO - DETAILED MEMBER STATEMENT\n`;
    statement += `${"═".repeat(80)}\n`;
    statement += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;
    
    statement += `MEMBER INFORMATION\n`;
    statement += `${"─".repeat(80)}\n`;
    statement += `Full Name:      ${profile.full_name}\n`;
    statement += `Email:          ${profile.email}\n`;
    statement += `Phone:          ${profile.phone_number || "N/A"}\n`;
    statement += `Account Number: ${account.account_number}\n\n`;

    statement += `ACCOUNT SUMMARY\n`;
    statement += `${"─".repeat(80)}\n`;
    statement += `Current Balance:      UGX ${Number(account.balance).toLocaleString()}\n`;
    statement += `Total Savings:        UGX ${Number(account.total_savings).toLocaleString()}\n`;
    statement += `Total Deposits:       UGX ${totalDeposits.toLocaleString()}\n`;
    statement += `Total Withdrawals:    UGX ${totalWithdrawals.toLocaleString()}\n`;
    statement += `Total Loan Repayments: UGX ${totalLoanRepayments.toLocaleString()}\n`;
    statement += `Total Welfare Paid:    UGX ${totalWelfare.toLocaleString()}\n`;
    statement += `Savings Contributions: UGX ${totalSavingsContributed.toLocaleString()}\n\n`;

    statement += `TRANSACTION HISTORY (${transactions?.length || 0} records)\n`;
    statement += `${"─".repeat(80)}\n`;
    statement += `${"Date & Time".padEnd(20)} | ${"Type".padEnd(18)} | ${"Amount".padStart(12)} | ${"Balance After".padStart(12)} | Status\n`;
    statement += `${"-".repeat(80)}\n`;
    if (transactions && transactions.length > 0) {
      transactions.forEach((t) => {
        const dateTime = format(new Date(t.created_at), "MMM dd, yyyy HH:mm");
        const type = t.transaction_type.replace("_", " ").toUpperCase();
        statement += `${dateTime.padEnd(20)} | ${type.padEnd(18)} | ${("UGX " + Number(t.amount).toLocaleString()).padStart(12)} | ${("UGX " + Number(t.balance_after).toLocaleString()).padStart(12)} | ${t.status.toUpperCase()}\n`;
        if (t.description) {
          statement += `  └─ ${t.description}\n`;
        }
      });
    } else {
      statement += `No transactions recorded.\n`;
    }

    statement += `\nLOAN HISTORY (${loans?.length || 0} records)\n`;
    statement += `${"─".repeat(80)}\n`;
    if (loans && loans.length > 0) {
      loans.forEach((l) => {
        statement += `Loan Applied: ${format(new Date(l.created_at), "MMM dd, yyyy HH:mm")}\n`;
        statement += `  Principal:    UGX ${Number(l.amount).toLocaleString()}\n`;
        statement += `  Interest:     ${l.interest_rate}%\n`;
        statement += `  Total Amount: UGX ${Number(l.total_amount).toLocaleString()}\n`;
        statement += `  Outstanding:  UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
        statement += `  Status:       ${l.status.toUpperCase()}\n`;
        if (l.approved_at) {
          statement += `  Approved:     ${format(new Date(l.approved_at), "MMM dd, yyyy HH:mm")}\n`;
        }
        if (l.disbursed_at) {
          statement += `  Disbursed:    ${format(new Date(l.disbursed_at), "MMM dd, yyyy HH:mm")}\n`;
        }
        statement += `\n`;
      });
    } else {
      statement += `No loans recorded.\n`;
    }

    statement += `\nWELFARE RECORDS (${welfare?.length || 0} entries)\n`;
    statement += `${"─".repeat(80)}\n`;
    if (welfare && welfare.length > 0) {
      welfare.slice(0, 20).forEach((w) => {
        statement += `${format(new Date(w.week_date), "MMM dd, yyyy")} | UGX ${Number(w.amount).toLocaleString()} | ${w.description || "Weekly welfare"}\n`;
      });
      if (welfare.length > 20) {
        statement += `... and ${welfare.length - 20} more entries\n`;
      }
    } else {
      statement += `No welfare entries recorded.\n`;
    }

    statement += `\n${"═".repeat(80)}\n`;
    statement += `End of Statement - KINONI SACCO Management System\n`;

    // Download as text file
    const blob = new Blob([statement], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${account.account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Statement generated successfully",
    });

    setLoading(false);
  };

  const generateGroupStatement = async () => {
    setLoading(true);

    // Get all accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("balance, total_savings");

    // Get all transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    // Get all loans
    const { data: loans } = await supabase
      .from("loans")
      .select("*");

    const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    const totalSavings = accounts?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;
    const totalLoans = loans?.reduce((sum, loan) => sum + Number(loan.outstanding_balance), 0) || 0;

    let statement = `KINONI SACCO - GROUP STATEMENT\n`;
    statement += `Generated: ${format(new Date(), "MMMM dd, yyyy")}\n\n`;
    statement += `Total Members: ${accounts?.length || 0}\n`;
    statement += `Total Balance: UGX ${totalBalance.toLocaleString()}\n`;
    statement += `Total Savings: UGX ${totalSavings.toLocaleString()}\n`;
    statement += `Total Outstanding Loans: UGX ${totalLoans.toLocaleString()}\n\n`;

    statement += `RECENT TRANSACTIONS\n`;
    statement += `${"=".repeat(80)}\n`;
    transactions?.slice(0, 50).forEach((t) => {
      statement += `${format(new Date(t.created_at), "MMM dd, yyyy")} | `;
      statement += `${t.transaction_type.toUpperCase().padEnd(20)} | `;
      statement += `UGX ${t.amount.toLocaleString().padStart(15)} | `;
      statement += `${t.status}\n`;
    });

    const blob = new Blob([statement], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group_statement_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Group statement generated successfully",
    });

    setLoading(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Member Statement</CardTitle>
          <CardDescription>Generate statement for a specific member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Member</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember} onOpenChange={(open) => {
              if (open && members.length === 0) {
                loadMembers();
              }
            }}>
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
          <Button onClick={generateMemberStatement} className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileDown className="mr-2 h-4 w-4" />
            Generate Statement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Group Statement</CardTitle>
          <CardDescription>Generate consolidated statement for all members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will generate a comprehensive statement including all member accounts,
            transactions, and loans.
          </p>
          <Button onClick={generateGroupStatement} className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileDown className="mr-2 h-4 w-4" />
            Generate Group Statement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatementsGeneration;
