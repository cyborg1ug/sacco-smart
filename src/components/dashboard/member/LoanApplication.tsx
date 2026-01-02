import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, Users } from "lucide-react";

interface LoanApplicationProps {
  onApplicationSubmitted: () => void;
}

interface EligibilityData {
  is_eligible: boolean;
  total_savings: number;
  max_loan_amount: number;
}

interface MemberOption {
  id: string;
  account_number: string;
  full_name: string;
  total_savings: number;
}

const LoanApplication = ({ onApplicationSubmitted }: LoanApplicationProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedGuarantor, setSelectedGuarantor] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [guarantorError, setGuarantorError] = useState("");
  const [mySavings, setMySavings] = useState(0);

  useEffect(() => {
    checkEligibility();
    loadMembers();
  }, []);

  const checkEligibility = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id, total_savings")
        .eq("user_id", user.id)
        .single();

      if (account) {
        setAccountId(account.id);
        setMySavings(account.total_savings || 0);
        
        const { data, error } = await supabase
          .rpc("check_loan_eligibility", { p_account_id: account.id });

        if (!error && data) {
          setEligibility(data as unknown as EligibilityData);
        }
      }
    }
    
    setCheckingEligibility(false);
  };

  const loadMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Get all accounts except current user's - only main accounts
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, account_number, user_id, total_savings")
        .neq("user_id", user.id)
        .eq("account_type", "main");

      if (accounts && accounts.length > 0) {
        // Fetch profiles for each account
        const userIds = [...new Set(accounts.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const membersWithProfiles = accounts.map((account) => ({
          id: account.id,
          account_number: account.account_number,
          full_name: profilesMap.get(account.user_id)?.full_name || "Unknown",
          total_savings: account.total_savings,
        }));

        setMembers(membersWithProfiles);
      }
    }
  };

  const validateGuarantor = (guarantorId: string) => {
    if (!guarantorId) {
      setGuarantorError("Please select a guarantor");
      return false;
    }

    const guarantor = members.find(m => m.id === guarantorId);
    if (!guarantor || guarantor.total_savings < mySavings) {
      setGuarantorError("Selected member's savings must be equal to or greater than yours to be your guarantor");
      return false;
    }

    setGuarantorError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const amount = parseFloat(loanAmount);

    if (!eligibility) {
      setLoading(false);
      return;
    }

    if (amount > eligibility.max_loan_amount) {
      toast({
        title: "Amount Exceeds Limit",
        description: `Maximum loan amount is UGX ${eligibility.max_loan_amount.toLocaleString()} (3x your savings)`,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const isGuarantorValid = validateGuarantor(selectedGuarantor);
    if (!isGuarantorValid) {
      setLoading(false);
      return;
    }

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
        guarantor_account_id: selectedGuarantor,
        guarantor_status: "pending",
        max_loan_amount: eligibility.max_loan_amount,
      } as any);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Loan application submitted. Waiting for guarantor approval.",
      });
      onApplicationSubmitted();
      setLoanAmount("");
      setSelectedGuarantor("");
    }

    setLoading(false);
  };

  if (checkingEligibility) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const selectedMember = members.find(m => m.id === selectedGuarantor);
  const eligibleGuarantors = members.filter(m => m.total_savings >= mySavings);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply for a Loan</CardTitle>
        <CardDescription>Submit a new loan application with a guarantor</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!eligibility?.is_eligible ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are not currently eligible for a loan. To qualify, you must have savings in your account.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                You are eligible for a loan! Maximum amount: UGX {eligibility.max_loan_amount.toLocaleString()} 
                (3× your savings of UGX {eligibility.total_savings.toLocaleString()})
              </AlertDescription>
            </Alert>

            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                You need a guarantor whose total savings is equal to or greater than yours (UGX {mySavings.toLocaleString()}).
                The guarantor must approve your request before the loan can be processed.
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
                  max={eligibility.max_loan_amount}
                  placeholder="Enter amount"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Interest Rate: 2% | Maximum: UGX {eligibility.max_loan_amount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guarantor">Select Guarantor</Label>
                <Select value={selectedGuarantor} onValueChange={setSelectedGuarantor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a member as guarantor" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleGuarantors.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eligibleGuarantors.length === 0 && (
                  <p className="text-sm text-destructive">
                    No eligible guarantors found. A guarantor must have savings ≥ UGX {mySavings.toLocaleString()}
                  </p>
                )}
                {guarantorError && (
                  <p className="text-sm text-destructive">{guarantorError}</p>
                )}
                {selectedMember && (
                  <p className="text-sm text-muted-foreground">
                    {selectedMember.full_name} will receive a request to guarantee your loan
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !selectedGuarantor || eligibleGuarantors.length === 0}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            </form>
          </>
        )}

        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">Loan Requirements:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>You must have savings in your account</li>
            <li>Maximum loan: 3× your total savings</li>
            <li>Guarantor's savings must be ≥ your savings</li>
            <li>Guarantor must approve your request</li>
            <li>Interest rate: 2%</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoanApplication;
