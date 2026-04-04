import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle, Users, Wallet, Sparkles, ShieldCheck, ShieldX, TriangleAlert, RefreshCw } from "lucide-react";

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

interface AICheck {
  rule: string;
  passed: boolean;
  detail: string;
}

interface AIEligibility {
  overall_eligible: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  summary: string;
  checks: AICheck[];
  recommendation: string;
}

const riskColors: Record<string, string> = {
  low: "text-chart-2 bg-chart-2/10 border-chart-2/30",
  medium: "text-chart-4 bg-chart-4/10 border-chart-4/30",
  high: "text-chart-5 bg-chart-5/10 border-chart-5/30",
  critical: "text-destructive bg-destructive/10 border-destructive/30",
};

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
  const [loanPurpose, setLoanPurpose] = useState("");
  const [customPurpose, setCustomPurpose] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("1");
  const [guarantorError, setGuarantorError] = useState("");

  // AI eligibility state
  const [aiEligibility, setAiEligibility] = useState<AIEligibility | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChecked, setAiChecked] = useState(false);

  useEffect(() => {
    loadMyAccounts();
    loadMembers();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      checkEligibility(selectedAccountId);
      setAiEligibility(null);
      setAiChecked(false);
      // Reload guarantors filtered by this account's savings at DB level
      // Reload guarantors — will be re-filtered by loan amount when amount is entered
      loadMembers(0);
      setSelectedGuarantor("");
    }
  }, [selectedAccountId, myAccounts]);

  // Auto-run AI check when key fields change
  useEffect(() => {
    if (!selectedAccountId) return;
    const timer = setTimeout(() => {
      runAICheck();
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedAccountId, loanAmount, repaymentMonths, selectedGuarantor]);

  const loadMyAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: mainAccount } = await supabase
      .from("accounts")
      .select("id, account_number, total_savings, account_type")
      .eq("user_id", user.id)
      .eq("account_type", "main")
      .single();

    if (!mainAccount) { setCheckingEligibility(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const accounts: AccountOption[] = [{ ...mainAccount, full_name: profile?.full_name || "Main Account" }];

    const { data: subAccounts } = await supabase
      .from("accounts")
      .select("id, account_number, total_savings, account_type")
      .eq("parent_account_id", mainAccount.id)
      .eq("account_type", "sub");

    if (subAccounts?.length) {
      const subAccountIds = subAccounts.map(a => a.id);
      const { data: subProfiles } = await supabase
        .from("sub_account_profiles")
        .select("account_id, full_name")
        .in("account_id", subAccountIds);
      const profilesMap = new Map(subProfiles?.map(p => [p.account_id, p.full_name]) || []);
      subAccounts.forEach(sa => accounts.push({ ...sa, full_name: profilesMap.get(sa.id) || sa.account_number }));
    }

    setMyAccounts(accounts);
    if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
  };

  const checkEligibility = async (accountId: string) => {
    setCheckingEligibility(true);
    const { data, error } = await supabase.rpc("check_loan_eligibility", { p_account_id: accountId });
    if (!error && data) setEligibility(data as unknown as EligibilityData);
    else setEligibility(null);
    setCheckingEligibility(false);
  };

  const loadMembers = async (minSavings = 0) => {
    const { data, error } = await supabase.rpc("get_guarantor_candidates", {
      p_min_savings: minSavings,
    } as any);
    if (error) { console.error("Error loading guarantor candidates:", error); return; }
    setMembers(
      (data ?? []).map((c: any) => ({
        id: c.account_id,
        account_number: c.account_number,
        full_name: c.full_name,
        total_savings: c.total_savings,
        account_type: c.account_type,
      }))
    );
  };

  const getSelectedAccountSavings = () => myAccounts.find(a => a.id === selectedAccountId)?.total_savings || 0;

  const runAICheck = useCallback(async () => {
    if (!selectedAccountId) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-loan-eligibility", {
        body: {
          accountId: selectedAccountId,
          loanAmount: loanAmount ? parseFloat(loanAmount) : 0,
          repaymentMonths: parseInt(repaymentMonths) || 1,
          guarantorAccountId: selectedGuarantor || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "AI Check Error", description: data.error, variant: "destructive" });
        return;
      }
      setAiEligibility(data as AIEligibility);
      setAiChecked(true);
    } catch (err: any) {
      toast({ title: "AI Check Failed", description: err.message || "Could not run AI eligibility check", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }, [selectedAccountId, loanAmount, repaymentMonths, selectedGuarantor]);

  const validateGuarantor = (guarantorId: string) => {
    if (!guarantorId) { setGuarantorError("Please select a guarantor"); return false; }
    const amount = parseFloat(loanAmount) || 0;
    const minRequired = amount * 0.5;
    const guarantor = members.find(m => m.id === guarantorId);
    if (guarantorId === selectedAccountId) { setGuarantorError("You cannot be your own guarantor"); return false; }
    if (!guarantor || guarantor.total_savings < minRequired) {
      setGuarantorError(`Selected member's savings must be at least 50% of the loan amount (UGX ${minRequired.toLocaleString()})`);
      return false;
    }
    setGuarantorError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Require purpose
    const finalPurpose = loanPurpose === "Other" ? customPurpose.trim() : loanPurpose;
    if (!finalPurpose) {
      toast({ title: "Purpose Required", description: "Please select or specify the purpose of the loan", variant: "destructive" });
      return;
    }

    // Block submission if AI says not eligible
    if (aiEligibility && !aiEligibility.overall_eligible) {
      toast({
        title: "Eligibility Check Failed",
        description: aiEligibility.summary,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const amount = parseFloat(loanAmount);
    if (!eligibility || !selectedAccountId) { setLoading(false); return; }

    if (amount > eligibility.max_loan_amount) {
      toast({ title: "Amount Exceeds Limit", description: `Maximum loan amount is UGX ${eligibility.max_loan_amount.toLocaleString()} (3x your savings)`, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!validateGuarantor(selectedGuarantor)) { setLoading(false); return; }

    const interestRate = 2.0;
    const months = parseInt(repaymentMonths) || 1;
    const totalInterest = amount * (interestRate / 100) * months;
    const totalAmount = amount + totalInterest;

    const { error } = await supabase.from("loans").insert({
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
      purpose: finalPurpose,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Loan application submitted. Waiting for guarantor approval." });
      onApplicationSubmitted();
      setLoanAmount("");
      setLoanPurpose("");
      setCustomPurpose("");
      setRepaymentMonths("1");
      setSelectedGuarantor("");
      setAiEligibility(null);
      setAiChecked(false);
    }
    setLoading(false);
  };

  if (checkingEligibility && myAccounts.length === 0) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const mySavings = getSelectedAccountSavings();
  // DB already filtered by savings >= mySavings; just exclude the applicant's own account
  const eligibleGuarantors = members.filter(m => m.id !== selectedAccountId);
  const selectedAccount = myAccounts.find(a => a.id === selectedAccountId);
  const selectedMember = members.find(m => m.id === selectedGuarantor);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Apply for a Loan</CardTitle>
          <CardDescription>Submit a new loan application with a guarantor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Selection */}
          {myAccounts.length > 1 && (
            <div className="space-y-2">
              <Label>Apply From Account</Label>
              <Select value={selectedAccountId} onValueChange={(v) => { setSelectedAccountId(v); setSelectedGuarantor(""); }}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {myAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {account.full_name} ({account.account_number})
                        {account.account_type === "sub" && <span className="text-xs text-muted-foreground">· Sub-account</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-sm text-muted-foreground">Account savings: UGX {selectedAccount.total_savings.toLocaleString()}</p>
              )}
            </div>
          )}

          {checkingEligibility ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : !eligibility?.is_eligible ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedAccount?.account_type === "sub"
                  ? "This sub-account is not eligible for a loan. To qualify, it must have savings."
                  : "You are not currently eligible for a loan. To qualify, you must have savings in your account."}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4 text-chart-2" />
                <AlertDescription>
                  {selectedAccount?.account_type === "sub" ? "This sub-account is eligible for a loan! " : "You are eligible for a loan! "}
                  Maximum amount: <strong>UGX {eligibility.max_loan_amount.toLocaleString()}</strong> (3× savings of UGX {eligibility.total_savings.toLocaleString()})
                </AlertDescription>
              </Alert>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Loan Amount (UGX)</Label>
                  <Input
                    type="number" step="1000" min="1000"
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
                  <Label>Purpose <span className="text-destructive">*</span></Label>
                  <Select value={loanPurpose} onValueChange={(v) => { setLoanPurpose(v); if (v !== "Other") setCustomPurpose(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select loan purpose" /></SelectTrigger>
                    <SelectContent>
                      {["Business Capital", "School Fees / Education", "Medical / Health", "Agriculture / Farming", "Home Construction / Renovation", "Emergency", "Asset Purchase", "Personal / Household", "Debt Consolidation", "Other"].map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loanPurpose === "Other" && (
                    <Input
                      type="text"
                      placeholder="Please specify the loan purpose"
                      value={customPurpose}
                      onChange={(e) => setCustomPurpose(e.target.value)}
                      required
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Repayment Plan (Months)</Label>
                  <Select value={repaymentMonths} onValueChange={setRepaymentMonths}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 9, 12].map(m => (
                        <SelectItem key={m} value={m.toString()}>{m} month{m > 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loanAmount && repaymentMonths && (
                    <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                      <p><span className="font-medium">Loan Amount:</span> UGX {parseFloat(loanAmount).toLocaleString()}</p>
                      <p><span className="font-medium">Interest ({repaymentMonths} mo @ 2%/mo):</span> UGX {(parseFloat(loanAmount) * 0.02 * parseInt(repaymentMonths)).toLocaleString()}</p>
                      <p className="font-semibold text-primary"><span className="font-medium">Total Repayment:</span> UGX {(parseFloat(loanAmount) * (1 + 0.02 * parseInt(repaymentMonths))).toLocaleString()}</p>
                      <p><span className="font-medium">Monthly Payment:</span> UGX {((parseFloat(loanAmount) * (1 + 0.02 * parseInt(repaymentMonths))) / parseInt(repaymentMonths)).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Select Guarantor</Label>
                  <Select value={selectedGuarantor} onValueChange={setSelectedGuarantor}>
                    <SelectTrigger><SelectValue placeholder="Choose a member as guarantor" /></SelectTrigger>
                    <SelectContent>
                      {eligibleGuarantors.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name} ({m.account_number}) {m.account_type === "sub" ? "· Sub-account" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {eligibleGuarantors.length === 0 && (
                    <p className="text-sm text-destructive">No eligible guarantors found. A guarantor must have savings ≥ 50% of the loan amount and must not be guaranteeing another active loan.</p>
                  )}
                  {guarantorError && <p className="text-sm text-destructive">{guarantorError}</p>}
                  {selectedMember && (
                    <p className="text-sm text-muted-foreground">{selectedMember.full_name} will receive a request to guarantee this loan</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !selectedGuarantor || eligibleGuarantors.length === 0 || (aiChecked && !aiEligibility?.overall_eligible)}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Application
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Eligibility Analysis Panel */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">AI Eligibility Analysis</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={runAICheck} disabled={aiLoading} className="h-8 gap-1.5 text-xs">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {aiLoading ? "Analysing…" : "Re-check"}
            </Button>
          </div>
          <CardDescription>Real-time AI assessment of all eligibility rules</CardDescription>
        </CardHeader>
        <CardContent>
          {aiLoading && !aiEligibility && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Running eligibility checks…</p>
            </div>
          )}

          {!aiLoading && !aiEligibility && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-30" />
              <p className="text-sm text-center">Select an account and fill in loan details to get an AI eligibility assessment.</p>
            </div>
          )}

          {aiEligibility && (
            <div className="space-y-4">
              {/* Verdict banner */}
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${riskColors[aiEligibility.risk_level]}`}>
                {aiEligibility.overall_eligible
                  ? <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />
                  : <ShieldX className="h-5 w-5 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{aiEligibility.overall_eligible ? "Eligible" : "Not Eligible"}</p>
                    <Badge variant="outline" className={`text-[10px] uppercase ${riskColors[aiEligibility.risk_level]}`}>
                      {aiEligibility.risk_level} risk
                    </Badge>
                  </div>
                  <p className="text-xs mt-1 opacity-90">{aiEligibility.summary}</p>
                </div>
              </div>

              {/* Rule checks */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eligibility Checks</p>
                {aiEligibility.checks.map((check, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-md border text-sm ${check.passed ? "bg-chart-2/5 border-chart-2/20" : "bg-destructive/5 border-destructive/20"}`}>
                    {check.passed
                      ? <CheckCircle className="h-4 w-4 text-chart-2 shrink-0 mt-0.5" />
                      : <TriangleAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                    <div>
                      <p className={`font-medium text-xs ${check.passed ? "text-chart-2" : "text-destructive"}`}>{check.rule}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              {aiEligibility.recommendation && (
                <div className="flex gap-2.5 p-3 rounded-lg bg-muted border border-border text-sm">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground text-xs leading-relaxed">{aiEligibility.recommendation}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loan Requirements reference */}
      <Card>
        <CardContent className="pt-4">
          <h4 className="font-semibold mb-2 text-sm">Loan Requirements</h4>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            <li>The applying account must have savings</li>
            <li>Maximum loan: 3× the account's total savings</li>
            <li>Guarantor's savings must be ≥ the loan amount being applied for</li>
            <li>A loan purpose must be specified</li>
            <li>Guarantor must approve your request before processing</li>
            <li>Interest rate: 2% per month flat</li>
            <li>Repayment period: 1–12 months</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanApplication;
