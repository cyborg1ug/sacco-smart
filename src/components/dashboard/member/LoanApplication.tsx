import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface LoanApplicationProps {
  onApplicationSubmitted: () => void;
}

const LoanApplication = ({ onApplicationSubmitted }: LoanApplicationProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (account) {
        setAccountId(account.id);
        
        const { data, error } = await supabase
          .rpc("check_loan_eligibility", { p_account_id: account.id });

        if (!error && data) {
          setIsEligible(data);
        }
      }
    }
    
    setCheckingEligibility(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    const interestRate = 2.0;
    const totalAmount = amount + (amount * interestRate / 100);

    const { error } = await supabase
      .from("loans")
      .insert({
        account_id: accountId,
        amount,
        interest_rate: interestRate,
        total_amount: totalAmount,
        outstanding_balance: totalAmount,
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
        description: "Loan application submitted successfully",
      });
      onApplicationSubmitted();
      (e.target as HTMLFormElement).reset();
    }

    setLoading(false);
  };

  if (checkingEligibility) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply for a Loan</CardTitle>
        <CardDescription>Submit a new loan application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEligible ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are not currently eligible for a loan. To qualify, you must have saved at least
              UGX 10,000 per week for the past 4 consecutive weeks.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription>
                You are eligible for a loan! The interest rate is 2% on the loan amount.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Loan Amount (UGX)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="1000"
                  min="1000"
                  placeholder="Enter amount"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Interest Rate: 2% | Total will be calculated automatically
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            </form>
          </>
        )}

        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">Loan Eligibility Requirements:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Minimum of 4 consecutive weeks of savings</li>
            <li>At least UGX 10,000 saved per week</li>
            <li>Account must be in good standing</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoanApplication;
