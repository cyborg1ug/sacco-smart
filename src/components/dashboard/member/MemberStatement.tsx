import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { generateMemberStatementPDF } from "@/lib/pdfGenerator";
import FinancialCharts from "../charts/FinancialCharts";

const MemberStatement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accountData, setAccountData] = useState<any>(null);
  const [subAccountsData, setSubAccountsData] = useState<any[]>([]);
  const [jointTotals, setJointTotals] = useState<{ balance: number; total_savings: number } | null>(null);
  const [chartData, setChartData] = useState<{
    transactionData: { month: string; deposits: number; withdrawals: number }[];
    savingsData: { week: string; amount: number }[];
    balanceData: { date: string; balance: number }[];
  } | null>(null);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, phone_number")
        .eq("id", user.id)
        .single();

      const { data: account } = await supabase
        .from("accounts")
        .select("id, account_number, balance, total_savings")
        .eq("user_id", user.id)
        .eq("account_type", "main")
        .single();

      if (profile && account) {
        setAccountData({ profile, account });
        loadChartData(account.id);

        // Load sub-accounts
        const { data: subAccounts } = await supabase
          .from("accounts")
          .select("id, account_number, balance, total_savings")
          .eq("parent_account_id", account.id)
          .eq("account_type", "sub");

        if (subAccounts && subAccounts.length > 0) {
          // Get sub-account profiles
          const subAccountIds = subAccounts.map(a => a.id);
          const { data: subProfiles } = await supabase
            .from("sub_account_profiles")
            .select("account_id, full_name")
            .in("account_id", subAccountIds);

          const profilesMap = new Map(subProfiles?.map(p => [p.account_id, p]) || []);
          const subAccountsWithProfiles = subAccounts.map(sa => ({
            ...sa,
            profile: profilesMap.get(sa.id) || null
          }));
          setSubAccountsData(subAccountsWithProfiles);

          // Calculate joint totals
          const jointBalance = account.balance + subAccounts.reduce((sum, sa) => sum + Number(sa.balance), 0);
          const jointSavings = account.total_savings + subAccounts.reduce((sum, sa) => sum + Number(sa.total_savings), 0);
          setJointTotals({ balance: jointBalance, total_savings: jointSavings });
        }
      }
    }
  };

  const loadChartData = async (accountId: string) => {
    // Get transactions for chart
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", accountId)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    // Get savings
    const { data: savings } = await supabase
      .from("savings")
      .select("*")
      .eq("account_id", accountId)
      .order("week_start", { ascending: true });

    // Process transaction data by month
    const monthlyData: { [key: string]: { deposits: number; withdrawals: number } } = {};
    transactions?.forEach((t) => {
      const month = format(new Date(t.created_at), "MMM");
      if (!monthlyData[month]) {
        monthlyData[month] = { deposits: 0, withdrawals: 0 };
      }
      if (t.transaction_type === "deposit") {
        monthlyData[month].deposits += Number(t.amount);
      } else if (t.transaction_type === "withdrawal") {
        monthlyData[month].withdrawals += Number(t.amount);
      }
    });

    const transactionData = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      deposits: data.deposits,
      withdrawals: data.withdrawals,
    }));

    // Process savings data
    const savingsData = savings?.map((s) => ({
      week: format(new Date(s.week_start), "MMM dd"),
      amount: Number(s.amount),
    })) || [];

    // Balance trend from transactions
    let runningBalance = 0;
    const balanceData = transactions?.map((t) => {
      if (t.transaction_type === "deposit" || t.transaction_type === "loan_disbursement") {
        runningBalance += Number(t.amount);
      } else {
        runningBalance -= Number(t.amount);
      }
      return {
        date: format(new Date(t.created_at), "MMM dd"),
        balance: runningBalance,
      };
    }) || [];

    setChartData({ transactionData, savingsData, balanceData });
  };

  const generateStatement = async (asPdf = false, includeSubAccounts = false) => {
    if (!accountData) {
      toast({
        title: "Error",
        description: "Account data not loaded",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Get main account transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", accountData.account.id)
      .order("created_at", { ascending: false });

    // Get sub-account transactions if requested
    let subAccountTransactions: any[] = [];
    if (includeSubAccounts && subAccountsData.length > 0) {
      const subAccountIds = subAccountsData.map(sa => sa.id);
      const { data: subTrans } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", subAccountIds)
        .order("created_at", { ascending: false });
      subAccountTransactions = subTrans || [];
    }

    // Get loans
    const { data: loans } = await supabase
      .from("loans")
      .select("*")
      .eq("account_id", accountData.account.id);

    // Get savings
    const { data: savings } = await supabase
      .from("savings")
      .select("*")
      .eq("account_id", accountData.account.id)
      .order("week_start", { ascending: false });

    // Get sub-account savings if requested
    let subAccountSavings: any[] = [];
    if (includeSubAccounts && subAccountsData.length > 0) {
      const subAccountIds = subAccountsData.map(sa => sa.id);
      const { data: subSav } = await supabase
        .from("savings")
        .select("*")
        .in("account_id", subAccountIds)
        .order("week_start", { ascending: false });
      subAccountSavings = subSav || [];
    }

    const allTransactions = includeSubAccounts 
      ? [...(transactions || []), ...subAccountTransactions].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : transactions || [];

    const allSavings = includeSubAccounts
      ? [...(savings || []), ...subAccountSavings]
      : savings || [];

    if (asPdf) {
      const balance = includeSubAccounts && jointTotals ? jointTotals.balance : Number(accountData.account.balance);
      const totalSavingsAmount = includeSubAccounts && jointTotals ? jointTotals.total_savings : Number(accountData.account.total_savings);
      
      generateMemberStatementPDF({
        memberName: accountData.profile.full_name + (includeSubAccounts ? " (Joint Statement)" : ""),
        email: accountData.profile.email,
        phoneNumber: accountData.profile.phone_number,
        accountNumber: accountData.account.account_number,
        balance: balance,
        totalSavings: totalSavingsAmount,
        transactions: allTransactions,
        loans: loans || [],
        savings: allSavings,
      });

      toast({
        title: "Success",
        description: "Your PDF statement has been downloaded",
      });
    } else {
      // Generate statement text
      let statement = `KINONI SACCO - ${includeSubAccounts ? "JOINT " : ""}MEMBER STATEMENT\n`;
      statement += `${"=".repeat(80)}\n`;
      statement += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;
      
      statement += `ACCOUNT DETAILS\n`;
      statement += `${"─".repeat(80)}\n`;
      statement += `Member Name:    ${accountData.profile.full_name}\n`;
      statement += `Email:          ${accountData.profile.email}\n`;
      statement += `Phone:          ${accountData.profile.phone_number || "N/A"}\n`;
      statement += `Account Number: ${accountData.account.account_number}\n`;
      statement += `Current Balance: UGX ${Number(accountData.account.balance).toLocaleString()}\n`;
      statement += `Total Savings:   UGX ${Number(accountData.account.total_savings).toLocaleString()}\n\n`;

      // Sub-accounts section
      if (includeSubAccounts && subAccountsData.length > 0) {
        statement += `SUB-ACCOUNTS\n`;
        statement += `${"─".repeat(80)}\n`;
        subAccountsData.forEach((sa) => {
          statement += `  ${sa.profile?.full_name || sa.account_number}\n`;
          statement += `    Account Number: ${sa.account_number}\n`;
          statement += `    Balance:        UGX ${Number(sa.balance).toLocaleString()}\n`;
          statement += `    Savings:        UGX ${Number(sa.total_savings).toLocaleString()}\n\n`;
        });

        statement += `JOINT TOTALS\n`;
        statement += `${"─".repeat(80)}\n`;
        statement += `Combined Balance: UGX ${jointTotals?.balance.toLocaleString()}\n`;
        statement += `Combined Savings: UGX ${jointTotals?.total_savings.toLocaleString()}\n\n`;
      }

      // Summary
      const totalDeposits = allTransactions.filter(t => t.transaction_type === "deposit" && t.status === "approved")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalWithdrawals = allTransactions.filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalLoanRepayments = allTransactions.filter(t => t.transaction_type === "loan_repayment" && t.status === "approved")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      statement += `FINANCIAL SUMMARY\n`;
      statement += `${"─".repeat(80)}\n`;
      statement += `Total Deposits:       UGX ${totalDeposits.toLocaleString()}\n`;
      statement += `Total Withdrawals:    UGX ${totalWithdrawals.toLocaleString()}\n`;
      statement += `Total Loan Repayments: UGX ${totalLoanRepayments.toLocaleString()}\n`;
      statement += `Net Cash Flow:        UGX ${(totalDeposits - totalWithdrawals - totalLoanRepayments).toLocaleString()}\n\n`;

      statement += `TRANSACTION HISTORY (${allTransactions.length} transactions)\n`;
      statement += `${"─".repeat(80)}\n`;
      statement += `${"Date & Time".padEnd(20)} | ${"Type".padEnd(18)} | ${"Amount".padStart(15)} | ${"Balance After".padStart(15)} | Status\n`;
      statement += `${"-".repeat(80)}\n`;
      if (allTransactions.length > 0) {
        allTransactions.forEach((t) => {
          const dateTime = format(new Date(t.created_at), "MMM dd, yyyy HH:mm");
          const type = t.transaction_type.replace("_", " ").toUpperCase();
          statement += `${dateTime.padEnd(20)} | ${type.padEnd(18)} | UGX ${Number(t.amount).toLocaleString().padStart(10)} | UGX ${Number(t.balance_after).toLocaleString().padStart(10)} | ${t.status.toUpperCase()}\n`;
          if (t.description) {
            statement += `  └─ ${t.description}\n`;
          }
        });
      } else {
        statement += `No transactions found.\n`;
      }

      statement += `\nSAVINGS RECORDS\n`;
      statement += `${"─".repeat(60)}\n`;
      if (allSavings.length > 0) {
        allSavings.forEach((s) => {
          statement += `Week: ${format(new Date(s.week_start), "MMM dd")} - ${format(new Date(s.week_end), "MMM dd, yyyy")} | `;
          statement += `Amount: UGX ${Number(s.amount).toLocaleString()}\n`;
        });
      } else {
        statement += `No savings records found.\n`;
      }

      statement += `\nLOAN HISTORY\n`;
      statement += `${"─".repeat(80)}\n`;
      if (loans && loans.length > 0) {
        loans.forEach((l) => {
          statement += `Loan ID: ${l.id.substring(0, 8)}...\n`;
          statement += `  Principal Amount:    UGX ${Number(l.amount).toLocaleString()}\n`;
          statement += `  Interest Rate:       ${l.interest_rate}%\n`;
          statement += `  Total Amount:        UGX ${Number(l.total_amount).toLocaleString()}\n`;
          statement += `  Outstanding Balance: UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
          statement += `  Status:              ${l.status.toUpperCase()}\n`;
          statement += `  Applied On:          ${format(new Date(l.created_at), "MMM dd, yyyy HH:mm")}\n`;
          if (l.approved_at) {
            statement += `  Approved On:         ${format(new Date(l.approved_at), "MMM dd, yyyy HH:mm")}\n`;
          }
          if (l.disbursed_at) {
            statement += `  Disbursed On:        ${format(new Date(l.disbursed_at), "MMM dd, yyyy HH:mm")}\n`;
          }
          statement += `\n`;
        });
      } else {
        statement += `No loan records found.\n`;
      }

      statement += `\n${"=".repeat(80)}\n`;
      statement += `This statement is generated by KINONI SACCO Management System.\n`;
      statement += `For any queries, please contact the administrator.\n`;

      // Download as text file
      const blob = new Blob([statement], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinoni_${includeSubAccounts ? "joint_" : ""}statement_${accountData.account.account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Your statement has been downloaded",
      });
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {chartData && (chartData.transactionData.length > 0 || chartData.savingsData.length > 0) && (
        <FinancialCharts
          transactionData={chartData.transactionData}
          savingsData={chartData.savingsData}
          balanceData={chartData.balanceData}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Statement</CardTitle>
          <CardDescription>Download your account statement with all transactions and savings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Statement includes:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Account details and current balances</li>
              <li>Complete transaction history</li>
              <li>Weekly savings records</li>
              <li>Loan history and outstanding balances</li>
              {subAccountsData.length > 0 && <li>Joint statement includes all sub-accounts</li>}
            </ul>
          </div>
          
          {/* Main Account Statement */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Main Account Statement</p>
            <div className="flex gap-2">
              <Button onClick={() => generateStatement(false, false)} className="flex-1" disabled={loading || !accountData}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileText className="mr-2 h-4 w-4" />
                Text
              </Button>
              <Button onClick={() => generateStatement(true, false)} variant="outline" className="flex-1" disabled={loading || !accountData}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          {/* Joint Statement - only if sub-accounts exist */}
          {subAccountsData.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium">Joint Statement (Main + Sub-accounts)</p>
              <div className="flex gap-2">
                <Button onClick={() => generateStatement(false, true)} variant="secondary" className="flex-1" disabled={loading || !accountData}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <FileText className="mr-2 h-4 w-4" />
                  Joint Text
                </Button>
                <Button onClick={() => generateStatement(true, true)} variant="secondary" className="flex-1" disabled={loading || !accountData}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <FileDown className="mr-2 h-4 w-4" />
                  Joint PDF
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberStatement;
