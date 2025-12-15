import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";

interface RecordTransactionProps {
  onTransactionRecorded: () => void;
}

const RecordTransaction = ({ onTransactionRecorded }: RecordTransactionProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [currentBalance, setCurrentBalance] = useState(0);
  const [transactionType, setTransactionType] = useState("");

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id, balance")
        .eq("user_id", user.id)
        .single();

      if (account) {
        setAccountId(account.id);
        setCurrentBalance(account.balance);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    const description = formData.get("description") as string;

    if (!transactionType) {
      toast({
        title: "Error",
        description: "Please select a transaction type",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Validation for withdrawals
    if ((transactionType === "withdrawal" || transactionType === "loan_repayment") && amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You cannot withdraw or repay more than your current balance",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .insert({
        account_id: accountId,
        transaction_type: transactionType,
        amount,
        description,
        status: "pending",
        balance_after: transactionType === "deposit" 
          ? currentBalance + amount 
          : currentBalance - amount,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Transaction Recorded",
        description: "Your transaction has been submitted and is pending admin approval",
      });
      onTransactionRecorded();
      (e.target as HTMLFormElement).reset();
      setTransactionType("");
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a Transaction</CardTitle>
        <CardDescription>Submit a transaction request for admin approval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            All transactions require admin approval before they are processed. 
            Your current balance is UGX {currentBalance.toLocaleString()}.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Transaction Type</Label>
            <Select value={transactionType} onValueChange={setTransactionType}>
              <SelectTrigger>
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (UGX)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="100"
              min="100"
              placeholder="Enter amount"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Add details about this transaction..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !transactionType}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Transaction
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RecordTransaction;
