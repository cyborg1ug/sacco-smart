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
import { Loader2, Info, CreditCard } from "lucide-react";

interface RecordTransactionProps {
  onTransactionRecorded: () => void;
}

interface ActiveLoan {
  id: string;
  amount: number;
  total_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  status: string;
}

const RecordTransaction = ({ onTransactionRecorded }: RecordTransactionProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [currentBalance, setCurrentBalance] = useState(0);
  const [transactionType, setTransactionType] = useState("");
  const [activeLoan, setActiveLoan] = useState<ActiveLoan | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");

  useEffect(() => {
    loadAccountData();
  }, []);

  useEffect(() => {
    if (accountId) {
      loadActiveLoan();
    }
  }, [accountId]);

  const loadAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Use maybeSingle to avoid errors if no account exists
      const { data: account } = await supabase
        .from("accounts")
        .select("id, balance, total_savings")
        .eq("user_id", user.id)
        .eq("account_type", "main")
        .maybeSingle();

      if (account) {
        setAccountId(account.id);
        setCurrentBalance(account.balance);
      }
    }
  };

  const loadActiveLoan = async () => {
    if (!accountId) return;

    const { data: loan } = await supabase
      .from("loans")
      .select("id, amount, total_amount, outstanding_balance, interest_rate, status")
      .eq("account_id", accountId)
      .in("status", ["approved", "disbursed"])
      .gt("outstanding_balance", 0)
      .maybeSingle();

    setActiveLoan(loan);
  };

  const handlePayFullAmount = () => {
    if (activeLoan) {
      setRepaymentAmount(activeLoan.outstanding_balance.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(transactionType === "loan_repayment" ? repaymentAmount : formData.get("amount") as string);
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

    // Validation for loan repayments
    if (transactionType === "loan_repayment") {
      if (!activeLoan) {
        toast({
          title: "No Active Loan",
          description: "You don't have an active loan to repay",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (amount > activeLoan.outstanding_balance) {
        toast({
          title: "Amount Exceeds Balance",
          description: `The repayment amount cannot exceed the outstanding balance of UGX ${activeLoan.outstanding_balance.toLocaleString()}`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (amount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid repayment amount",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
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
        loan_id: transactionType === "loan_repayment" && activeLoan ? activeLoan.id : null,
      } as any);

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
      setRepaymentAmount("");
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
                <SelectItem value="deposit">Saving Deposit</SelectItem>
                <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show active loan info when loan_repayment is selected */}
          {transactionType === "loan_repayment" && (
            <div className="space-y-3">
              {activeLoan ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Active Loan Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Loan Amount:</span>
                        <p className="font-medium">UGX {activeLoan.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interest Rate:</span>
                        <p className="font-medium">{activeLoan.interest_rate}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Amount:</span>
                        <p className="font-medium">UGX {activeLoan.total_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Outstanding Balance:</span>
                        <p className="font-semibold text-primary">UGX {activeLoan.outstanding_balance.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handlePayFullAmount}
                        className="w-full"
                      >
                        Pay Full Balance (UGX {activeLoan.outstanding_balance.toLocaleString()})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    You don't have an active loan to repay. If you've recently received a loan, please wait for it to be disbursed.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (UGX)</Label>
            {transactionType === "loan_repayment" ? (
              <Input
                id="amount"
                type="number"
                step="100"
                min="100"
                placeholder="Enter repayment amount"
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(e.target.value)}
                required
                disabled={!activeLoan}
              />
            ) : (
              <Input
                id="amount"
                name="amount"
                type="number"
                step="100"
                min="100"
                placeholder="Enter amount"
                required
              />
            )}
            {transactionType === "loan_repayment" && activeLoan && (
              <p className="text-xs text-muted-foreground">
                Enter partial amount or use the button above to pay the full outstanding balance
              </p>
            )}
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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !transactionType || (transactionType === "loan_repayment" && !activeLoan)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Transaction
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RecordTransaction;
