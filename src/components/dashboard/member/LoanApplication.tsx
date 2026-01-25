import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, Users, Wallet } from "lucide-react";

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
  account_type: string;
}

interface AccountOption {
  id: string;
  account_number: string;
  account_type: string;
  total_savings: number;
  full_name: string;
}

const LoanApplication = ({ onApplicationSubmitted }: LoanApplicationProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [myAccounts, setMyAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedGuarantor, setSelectedGuarantor] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("1");
  const [guarantorError, setGuarantorError] = useState("");

  useEffect(() => {
    loadMyAccounts();
    loadMembers();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      checkEligibility(selectedAccountId);
    }
  }, [selectedAccountId]);

  const loadMyAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Get main account
    const { data: mainAccount } = await supabase
      .from("accounts")
      .select("id, account_number, total_savings, account_type")
      .eq("user_id", user.id)
      .eq("account_type", "main")
      .single();

    if (!mainAccount) {
      setCheckingEligibility(false);
      return;
    }

    // Get user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const accounts: AccountOption[] = [{
      ...mainAccount,
      full_name: profile?.full_name || "Main Account"
    }];

    // Get sub-accounts
    const { data: subAccounts } = await supabase
      .from("accounts")
      .select("id, account_number, total_savings, account_type")
      .eq("parent_account_id", mainAccount.id)
      .eq("account_type", "sub");

    if (subAccounts && subAccounts.length > 0) {
      // Get sub-account profiles
      const subAccountIds = subAccounts.map(a => a.id);
      const { data: subProfiles } = await supabase
        .from("sub_account_profiles")
        .select("account_id, full_name")
        .in("account_id", subAccountIds);

      const profilesMap = new Map(subProfiles?.map(p => [p.account_id, p.full_name]) || []);

      subAccounts.forEach(sa => {
        accounts.push({
          ...sa,
          full_name: profilesMap.get(sa.id) || sa.account_number
        });
      });
    }

    setMyAccounts(accounts);
    
    // Default to main account
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  };

  const checkEligibility = async (accountId: string) => {
    setCheckingEligibility(true);
    
    const { data, error } = await supabase
      .rpc("check_loan_eligibility", { p_account_id: accountId });

    if (!error && data) {
      setEligibility(data as unknown as EligibilityData);
    } else {
      setEligibility(null);
    }
    
    setCheckingEligibility(false);
  };

  const loadMembers = async () => {
    // Use secure RPC function that only exposes necessary data for guarantor selection
    const { data, error } = await supabase.rpc("get_guarantor_candidates");

    if (error) {
      console.error("Error loading guarantor candidates:", error);
      return;
    }

    if (data && data.length > 0) {
      const membersWithProfiles = data.map((candidate: any) => ({
        id: candidate.account_id,
        account_number: candidate.account_number,
        full_name: candidate.full_name,
        total_savings: candidate.total_savings,
        account_type: candidate.account_type,
      }));

      setMembers(membersWithProfiles);
    }
  };

  const getSelectedAccountSavings = () => {
    const selectedAccount = myAccounts.find(a => a.id === selectedAccountId);
    return selectedAccount?.total_savings || 0;
  };

  const validateGuarantor = (guarantorId: string) => {
    if (!guarantorId) {
      setGuarantorError("Please select a guarantor");
      return false;
    }

    const mySavings = getSelectedAccountSavings();
    const guarantor = members.find(m => m.id === guarantorId);
    
    // Make sure selected guarantor is not the same account applying
    if (guarantorId === selectedAccountId) {
      setGuarantorError("You cannot be your own guarantor");
      return false;
    }

    if (!guarantor || guarantor.total_savings < mySavings) {
      setGuarantorError("Selected member's savings must be equal to or greater than the applying account's savings");
      return false;
    }

    setGuarantorError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const amount = parseFloat(loanAmount);

    if (!eligibility || !selectedAccountId) {
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
    const months = parseInt(repaymentMonths) || 1;
    // Fixed interest rate per month of loan activity
    const totalInterest = amount * (interestRate / 100) * months;
    const totalAmount = amount + totalInterest;

    const { error } = await supabase
      .from("loans")
      .insert({
        account_id: selectedAccountId,
        amount,
        interest_rate: interestRate,
        total_amount: totalAmount,
        outstanding_balance: totalAmount,
        status: "pending",
        guarantor_account_id: selectedGuarantor,
        guarantor_status: "pending",
        max_loan_amount: eligibility.max_loan_amount,
        repayment_months: months,
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
      setRepaymentMonths("1");
      setSelectedGuarantor("");
    }

    setLoading(false);
  };

  if (checkingEligibility && myAccounts.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const mySavings = getSelectedAccountSavings();
  const selectedMember = members.find(m => m.id === selectedGuarantor);
  
  // Filter guarantors: must have savings >= applying account's savings AND not be the applying account
  // Sub-accounts CAN guarantee main accounts and vice versa (within same owner)
  const eligibleGuarantors = members.filter(m => 
    m.total_savings >= mySavings && m.id !== selectedAccountId
  );

  const selectedAccount = myAccounts.find(a => a.id === selectedAccountId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply for a Loan</CardTitle>
        <CardDescription>Submit a new loan application with a guarantor</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Selection */}
        {myAccounts.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="account">Apply From Account</Label>
            <Select value={selectedAccountId} onValueChange={(value) => {
              setSelectedAccountId(value);
              setSelectedGuarantor(""); // Reset guarantor when account changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {myAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      {account.full_name} ({account.account_number})
                      {account.account_type === 'sub' && (
                        <span className="text-xs text-muted-foreground">• Sub-account</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccount && (
              <p className="text-sm text-muted-foreground">
                Account savings: UGX {selectedAccount.total_savings.toLocaleString()}
              </p>
            )}
          </div>
        )}

        {checkingEligibility ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !eligibility?.is_eligible ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {selectedAccount?.account_type === 'sub' 
                ? "This sub-account is not eligible for a loan. To qualify, it must have savings."
                : "You are not currently eligible for a loan. To qualify, you must have savings in your account."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                {selectedAccount?.account_type === 'sub' ? (
                  <>This sub-account is eligible for a loan! </>
                ) : (
                  <>You are eligible for a loan! </>
                )}
                Maximum amount: UGX {eligibility.max_loan_amount.toLocaleString()} 
                (3× savings of UGX {eligibility.total_savings.toLocaleString()})
              </AlertDescription>
            </Alert>

            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                You need a guarantor whose total savings is equal to or greater than this account's savings (UGX {mySavings.toLocaleString()}).
                The guarantor must approve your request before the loan can be processed.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Loan Amount (UGX)</Label>
                  <Input
                    id="amount"
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
                    Interest Rate: 2% per month | Maximum: UGX {eligibility.max_loan_amount.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repaymentMonths">Repayment Plan (Months)</Label>
                  <Select value={repaymentMonths} onValueChange={setRepaymentMonths}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select repayment period" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 9, 12].map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {month} month{month > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loanAmount && repaymentMonths && (
                    <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                      <p><span className="font-medium">Loan Amount:</span> UGX {parseFloat(loanAmount).toLocaleString()}</p>
                      <p><span className="font-medium">Interest ({repaymentMonths} months @ 2%/mo):</span> UGX {(parseFloat(loanAmount) * 0.02 * parseInt(repaymentMonths)).toLocaleString()}</p>
                      <p className="font-semibold text-primary"><span className="font-medium">Total Repayment:</span> UGX {(parseFloat(loanAmount) + (parseFloat(loanAmount) * 0.02 * parseInt(repaymentMonths))).toLocaleString()}</p>
                      <p><span className="font-medium">Monthly Payment:</span> UGX {((parseFloat(loanAmount) + (parseFloat(loanAmount) * 0.02 * parseInt(repaymentMonths))) / parseInt(repaymentMonths)).toLocaleString()}</p>
                    </div>
                  )}
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
                        {member.full_name} ({member.account_number}) {member.account_type === 'sub' ? '• Sub-account' : ''}
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
                    {selectedMember.full_name} will receive a request to guarantee this loan
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
            <li>The applying account must have savings</li>
            <li>Maximum loan: 3× the account's total savings</li>
            <li>Guarantor's savings must be ≥ applying account's savings</li>
            <li>Guarantor must approve your request</li>
            <li>Interest rate: 2%</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoanApplication;