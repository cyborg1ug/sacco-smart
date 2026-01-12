import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft, TrendingUp, TrendingDown, CreditCard, Wallet } from "lucide-react";
import { format } from "date-fns";
import { generateTransactionReceiptPDF } from "@/lib/pdfGenerator";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  tnx_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
  approved_at: string | null;
}

interface MemberInfo {
  full_name: string;
  account_number: string;
  balance: number;
  total_savings: number;
}

const AdminMemberTransactions = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);

  useEffect(() => {
    if (accountId) {
      loadMemberTransactions();
    }
  }, [accountId]);

  const loadMemberTransactions = async () => {
    if (!accountId) return;

    // Get account info
    const { data: account } = await supabase
      .from("accounts")
      .select("id, account_number, balance, total_savings, user_id, account_type")
      .eq("id", accountId)
      .single();

    if (!account) {
      setLoading(false);
      return;
    }

    // Get member name based on account type
    let fullName = "Unknown";
    if (account.account_type === "main") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", account.user_id)
        .single();
      fullName = profile?.full_name || "Unknown";
    } else {
      const { data: subProfile } = await supabase
        .from("sub_account_profiles")
        .select("full_name")
        .eq("account_id", account.id)
        .single();
      fullName = subProfile?.full_name || "Unknown";
    }

    setMemberInfo({
      full_name: fullName,
      account_number: account.account_number,
      balance: account.balance,
      total_savings: account.total_savings,
    });

    // Get transactions
    const { data: txns } = await supabase
      .from("transactions")
      .select("id, tnx_id, transaction_type, amount, balance_after, description, status, created_at, approved_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (txns) {
      setTransactions(txns);
    }
    setLoading(false);
  };

  const stats = useMemo(() => ({
    totalDeposits: transactions
      .filter(t => t.transaction_type === "deposit" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    totalWithdrawals: transactions
      .filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    totalLoanDisbursements: transactions
      .filter(t => t.transaction_type === "loan_disbursement" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    totalLoanRepayments: transactions
      .filter(t => t.transaction_type === "loan_repayment" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
  }), [transactions]);

  const handleDownloadReceipt = (transaction: Transaction) => {
    if (!memberInfo || transaction.status !== "approved") return;

    generateTransactionReceiptPDF({
      tnxId: transaction.tnx_id,
      memberName: memberInfo.full_name,
      accountNumber: memberInfo.account_number,
      transactionType: transaction.transaction_type,
      amount: transaction.amount,
      balanceAfter: transaction.balance_after,
      currentBalance: memberInfo.balance,
      totalSavings: memberInfo.total_savings,
      description: transaction.description,
      createdAt: transaction.created_at,
      approvedAt: transaction.approved_at || undefined,
    });

    toast({
      title: "Receipt Downloaded",
      description: `Receipt for transaction ${transaction.tnx_id} has been downloaded.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!memberInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto p-4 sm:p-6 space-y-6">
          <DashboardHeader
            title="Member Not Found"
            subtitle="The requested member account was not found"
            isAdmin
            showBackButton
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title={memberInfo.full_name}
          subtitle={`Account: ${memberInfo.account_number}`}
          isAdmin
          showBackButton
        />

        {/* Statistics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-2.5 sm:pt-4 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-success shrink-0" />
                <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Deposits</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalDeposits.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:pt-4 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-destructive shrink-0" />
                <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Withdrawals</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalWithdrawals.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:pt-4 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Disbursed</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalLoanDisbursements.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:pt-4 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 shrink-0" />
                <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Repayments</span>
              </div>
              <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalLoanRepayments.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Account Summary */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Current Balance</p>
              <p className="text-lg sm:text-2xl font-bold text-primary">UGX {memberInfo.balance.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Savings</p>
              <p className="text-lg sm:text-2xl font-bold text-success">UGX {memberInfo.total_savings.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Transaction History</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              All transactions for this member ({transactions.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-4 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>TXN ID</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Balance After</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No transactions found for this member
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(transaction.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">
                          {transaction.tnx_id}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell capitalize text-xs whitespace-nowrap">
                          {transaction.transaction_type.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-xs font-medium">
                          UGX {transaction.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right whitespace-nowrap text-xs">
                          UGX {transaction.balance_after.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            transaction.status === "approved" ? "default" :
                            transaction.status === "pending" ? "secondary" : "destructive"
                          } className="text-[9px] sm:text-[10px]">
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.status === "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReceipt(transaction)}
                              title="Download Receipt"
                              className="h-7 w-7 p-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMemberTransactions;
