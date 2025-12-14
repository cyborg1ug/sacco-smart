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
        .single();

      if (profile && account) {
        setAccountData({ profile, account });
        loadChartData(account.id);
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

  const generateStatement = async (asPdf = false) => {
    if (!accountData) {
      toast({
        title: "Error",
        description: "Account data not loaded",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Get transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", accountData.account.id)
      .order("created_at", { ascending: false });

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

    if (asPdf) {
      generateMemberStatementPDF({
        memberName: accountData.profile.full_name,
        email: accountData.profile.email,
        phoneNumber: accountData.profile.phone_number,
        accountNumber: accountData.account.account_number,
        balance: Number(accountData.account.balance),
        totalSavings: Number(accountData.account.total_savings),
        transactions: transactions || [],
        loans: loans || [],
        savings: savings || [],
      });

      toast({
        title: "Success",
        description: "Your PDF statement has been downloaded",
      });
    } else {
      // Generate statement text
      let statement = `KINONI SACCO - MEMBER STATEMENT\n`;
      statement += `${"=".repeat(60)}\n`;
      statement += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;
      statement += `ACCOUNT DETAILS\n`;
      statement += `${"─".repeat(60)}\n`;
      statement += `Member Name: ${accountData.profile.full_name}\n`;
      statement += `Email: ${accountData.profile.email}\n`;
      statement += `Account Number: ${accountData.account.account_number}\n\n`;
      statement += `Current Balance: UGX ${Number(accountData.account.balance).toLocaleString()}\n`;
      statement += `Total Savings: UGX ${Number(accountData.account.total_savings).toLocaleString()}\n\n`;

      statement += `TRANSACTION HISTORY\n`;
      statement += `${"─".repeat(60)}\n`;
      if (transactions && transactions.length > 0) {
        transactions.forEach((t) => {
          statement += `${format(new Date(t.created_at), "MMM dd, yyyy")} | `;
          statement += `${t.transaction_type.toUpperCase().padEnd(15)} | `;
          statement += `UGX ${Number(t.amount).toLocaleString().padStart(15)} | `;
          statement += `${t.status.toUpperCase()}\n`;
        });
      } else {
        statement += `No transactions found.\n`;
      }

      statement += `\nSAVINGS RECORDS\n`;
      statement += `${"─".repeat(60)}\n`;
      if (savings && savings.length > 0) {
        savings.forEach((s) => {
          statement += `Week: ${format(new Date(s.week_start), "MMM dd")} - ${format(new Date(s.week_end), "MMM dd, yyyy")} | `;
          statement += `Amount: UGX ${Number(s.amount).toLocaleString()}\n`;
        });
      } else {
        statement += `No savings records found.\n`;
      }

      statement += `\nLOAN HISTORY\n`;
      statement += `${"─".repeat(60)}\n`;
      if (loans && loans.length > 0) {
        loans.forEach((l) => {
          statement += `Amount: UGX ${Number(l.amount).toLocaleString()} | `;
          statement += `Interest: ${l.interest_rate}% | `;
          statement += `Outstanding: UGX ${Number(l.outstanding_balance).toLocaleString()} | `;
          statement += `Status: ${l.status.toUpperCase()}\n`;
        });
      } else {
        statement += `No loan records found.\n`;
      }

      statement += `\n${"=".repeat(60)}\n`;
      statement += `This statement is generated by KINONI SACCO Management System.\n`;

      // Download as text file
      const blob = new Blob([statement], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinoni_statement_${accountData.account.account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
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
            </ul>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => generateStatement(false)} className="flex-1" disabled={loading || !accountData}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-2 h-4 w-4" />
              Text Statement
            </Button>
            <Button onClick={() => generateStatement(true)} variant="outline" className="flex-1" disabled={loading || !accountData}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileDown className="mr-2 h-4 w-4" />
              PDF Statement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberStatement;
