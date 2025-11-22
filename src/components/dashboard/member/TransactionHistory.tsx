import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
}

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (account) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false });

        if (data) {
          setTransactions(data);
        }
      }
    }
    
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>View all your account transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance After</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No transactions yet
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(new Date(transaction.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="capitalize">{transaction.transaction_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">UGX {transaction.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">UGX {transaction.balance_after.toLocaleString()}</TableCell>
                  <TableCell>{transaction.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={
                      transaction.status === "approved" ? "default" :
                      transaction.status === "pending" ? "secondary" : "destructive"
                    }>
                      {transaction.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
