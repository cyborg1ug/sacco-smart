import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
  account: {
    id: string;
    account_number: string;
    user: {
      full_name: string;
    };
  };
}

interface TransactionsManagementProps {
  onUpdate: () => void;
}

const TransactionsManagement = ({ onUpdate }: TransactionsManagementProps) => {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    loadTransactions();
    loadMembers();
  }, []);

  const loadTransactions = async () => {
    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!transactionsData) {
      setLoading(false);
      return;
    }

    // Get account IDs and fetch accounts
    const accountIds = [...new Set(transactionsData.map(t => t.account_id))];
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id")
      .in("id", accountIds);

    // Get user IDs and fetch profiles
    const userIds = [...new Set(accountsData?.map(a => a.user_id) || [])];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const accountsMap = new Map(accountsData?.map(a => [a.id, {
      ...a,
      user: profilesMap.get(a.user_id) || { full_name: "Unknown" }
    }]) || []);

    const transactionsWithAccounts = transactionsData.map(t => ({
      ...t,
      account: accountsMap.get(t.account_id) || { id: t.account_id, account_number: "Unknown", user: { full_name: "Unknown" } }
    }));

    setTransactions(transactionsWithAccounts as any);
    setLoading(false);
  };

  const loadMembers = async () => {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, balance, user_id");

    if (!accountsData) return;

    const userIds = [...new Set(accountsData.map(a => a.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const membersWithProfiles = accountsData.map(a => ({
      ...a,
      user: profilesMap.get(a.user_id) || { full_name: "Unknown" }
    }));

    setMembers(membersWithProfiles);
  };

  const handleApprove = async (transactionId: string, accountId: string, amount: number, type: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: account } = await supabase
      .from("accounts")
      .select("balance, total_savings")
      .eq("id", accountId)
      .single();

    if (!account) return;

    // Validate sufficient balance for withdrawals and loan repayments
    if (type === "withdrawal" || type === "loan_repayment") {
      if (account.balance < amount) {
        toast({
          title: "Insufficient Balance",
          description: `Cannot process ${type.replace("_", " ")}. Available balance: UGX ${account.balance.toLocaleString()}, Requested: UGX ${amount.toLocaleString()}`,
          variant: "destructive",
        });
        return;
      }
    }

    let newBalance = account.balance;
    let newTotalSavings = account.total_savings;

    if (type === "deposit") {
      newBalance += amount;
      newTotalSavings += amount;
    } else if (type === "withdrawal") {
      newBalance -= amount;
    } else if (type === "loan_disbursement") {
      newBalance += amount;
    } else if (type === "loan_repayment") {
      newBalance -= amount;
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ balance: newBalance, total_savings: newTotalSavings })
      .eq("id", accountId);

    if (updateError) {
      toast({
        title: "Error",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        balance_after: newBalance,
      })
      .eq("id", transactionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction approved successfully",
      });
      loadTransactions();
      onUpdate();
    }
  };

  const handleReject = async (transactionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("transactions")
      .update({
        status: "rejected",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction rejected",
      });
      loadTransactions();
      onUpdate();
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const accountId = formData.get("accountId") as string;
    const type = formData.get("type") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const description = formData.get("description") as string;

    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", accountId)
      .single();

    if (!account) return;

    const { error } = await supabase
      .from("transactions")
      .insert({
        account_id: accountId,
        transaction_type: type,
        amount,
        description,
        balance_after: account.balance,
        status: "pending",
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction created successfully",
      });
      setDialogOpen(false);
      loadTransactions();
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Transactions Management</CardTitle>
            <CardDescription>Review and manage all transactions</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Transaction</DialogTitle>
                <DialogDescription>Record a transaction for a member</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Member Account</Label>
                  <Select name="accountId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.user.full_name} - {member.account_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Transaction Type</Label>
                  <Select name="type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Saving Deposit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                      <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (UGX)</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" />
                </div>
                <Button type="submit" className="w-full">Create Transaction</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{format(new Date(transaction.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell>{transaction.account.user.full_name}</TableCell>
                <TableCell>{transaction.account.account_number}</TableCell>
                <TableCell className="capitalize">{transaction.transaction_type.replace("_", " ")}</TableCell>
                <TableCell className="text-right">UGX {transaction.amount.toLocaleString()}</TableCell>
                <TableCell>{transaction.description || "—"}</TableCell>
                <TableCell>
                  <Badge variant={
                    transaction.status === "approved" ? "default" :
                    transaction.status === "pending" ? "secondary" : "destructive"
                  }>
                    {transaction.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {transaction.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(
                          transaction.id,
                          transaction.account.id,
                          transaction.amount,
                          transaction.transaction_type
                        )}
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(transaction.id)}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TransactionsManagement;
