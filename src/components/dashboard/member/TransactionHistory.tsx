import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Receipt } from "lucide-react";
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

const TransactionHistory = () => {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState<{ id: string; balance: number; total_savings: number; account_number: string } | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name);
      }

      const { data: account } = await supabase
        .from("accounts")
        .select("id, balance, total_savings, account_number")
        .eq("user_id", user.id)
        .eq("account_type", "main")
        .single();

      if (account) {
        setAccountData(account);
        const { data } = await supabase
          .from("transactions")
          .select("id, tnx_id, transaction_type, amount, balance_after, description, status, created_at, approved_at")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false });

        if (data) {
          setTransactions(data);
        }
      }
    }
    
    setLoading(false);
  };

  const handleDownloadReceipt = (transaction: Transaction) => {
    if (!accountData || transaction.status !== "approved") return;

    generateTransactionReceiptPDF({
      tnxId: transaction.tnx_id,
      memberName: userName,
      accountNumber: accountData.account_number,
      transactionType: transaction.transaction_type,
      amount: transaction.amount,
      balanceAfter: transaction.balance_after,
      currentBalance: accountData.balance,
      totalSavings: accountData.total_savings,
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
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Transaction History
        </CardTitle>
        <CardDescription>
          View all your account transactions. Current Balance: UGX {accountData?.balance.toLocaleString() || 0}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>TXN ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(transaction.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {transaction.tnx_id}
                    </TableCell>
                    <TableCell className="capitalize whitespace-nowrap">
                      {transaction.transaction_type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      UGX {transaction.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      UGX {transaction.balance_after.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        transaction.status === "approved" ? "default" :
                        transaction.status === "pending" ? "secondary" : "destructive"
                      }>
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
                        >
                          <Download className="h-4 w-4" />
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
  );
};

export default TransactionHistory;
