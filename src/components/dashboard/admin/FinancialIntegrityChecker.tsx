import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, AlertTriangle, XCircle, Loader2, RefreshCw,
  TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard, Banknote,
  CheckCircle2, Bot, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GrandTotals {
  deposits: number;
  withdrawals: number;
  loan_disbursements: number;
  loan_repayments: number;
  welfare_deductions: number;
}

interface BalanceIntegrity {
  stored_total_balance: number;
  calculated_total_balance: number;
  balance_difference: number;
  stored_total_savings: number;
  calculated_total_savings: number;
  savings_difference: number;
}

interface Summary {
  total_accounts: number;
  total_transactions: number;
  total_loans: number;
  account_discrepancies: number;
  loan_discrepancies: number;
  grand_totals: GrandTotals;
  balance_integrity: BalanceIntegrity;
}

interface AccountReport {
  account_id: string;
  account_number: string;
  account_type: string;
  owner_name: string;
  stored_balance: number;
  calculated_balance: number;
  balance_discrepancy: number;
  stored_savings: number;
  calculated_savings: number;
  savings_discrepancy: number;
  total_deposits: number;
  total_withdrawals: number;
  total_loan_disbursements: number;
  total_loan_repayments: number;
  transaction_count: number;
}

interface LoanReport {
  loan_id: string;
  account_number: string;
  owner_name: string;
  principal: number;
  total_amount: number;
  stored_outstanding: number;
  calculated_outstanding: number;
  discrepancy: number;
  total_repaid: number;
  status: string;
}

interface IntegrityResult {
  success: boolean;
  generated_at: string;
  ai_report: string;
  summary: Summary;
  account_reports: AccountReport[];
  loan_reports: LoanReport[];
}

const fmt = (n: number) =>
  `UGX ${new Intl.NumberFormat("en-UG", { minimumFractionDigits: 2 }).format(n)}`;

const DiscBadge = ({ val }: { val: number }) => {
  if (Math.abs(val) < 0.01)
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-xs font-mono">✓ Match</Badge>;
  return (
    <Badge className={cn("border-0 text-xs font-mono", val > 0 ? "bg-amber-500/15 text-amber-600" : "bg-destructive/15 text-destructive")}>
      {val > 0 ? "+" : ""}{fmt(val)}
    </Badge>
  );
};

const HealthBadge = ({ discrepancies }: { discrepancies: number }) => {
  if (discrepancies === 0)
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-sm gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Healthy</Badge>;
  if (discrepancies <= 3)
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-sm gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Minor Issues</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-sm gap-1.5"><XCircle className="w-3.5 h-3.5" />Critical Issues</Badge>;
};

export default function FinancialIntegrityChecker() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-financial-integrity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data: IntegrityResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleFixErrors = async () => {
    if (!result) return;
    setFixing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const fixes: Array<{ type: string; id: string; correct_value: number }> = [];

      // Collect account balance discrepancies
      for (const acc of result.account_reports) {
        if (Math.abs(acc.balance_discrepancy) > 0.01) {
          fixes.push({ type: "account_balance", id: acc.account_id, correct_value: acc.calculated_balance });
        }
      }

      // Collect loan outstanding discrepancies
      for (const loan of result.loan_reports) {
        if (Math.abs(loan.discrepancy) > 0.01) {
          fixes.push({ type: "loan_outstanding", id: loan.loan_id, correct_value: loan.calculated_outstanding });
        }
      }

      if (fixes.length === 0) {
        toast({ title: "No Fixes Needed", description: "All values already match." });
        setFixing(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/fix-integrity-errors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ fixes }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const fixResult = await res.json();
      toast({
        title: "Fixes Applied",
        description: fixResult.message,
      });

      // Re-run the integrity check to verify
      await runCheck();
    } catch (e) {
      toast({ title: "Fix Failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setFixing(false);
    }
  };

  const totalDiscrepancies = (result?.summary.account_discrepancies ?? 0) + (result?.summary.loan_discrepancies ?? 0);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Financial Integrity Check</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Recalculates all balances from transaction history and compares with stored values
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {result && (
                <HealthBadge discrepancies={totalDiscrepancies} />
              )}
              {result && totalDiscrepancies > 0 && (
                <Button onClick={handleFixErrors} disabled={fixing} variant="destructive" className="gap-2">
                  {fixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                  {fixing ? "Fixing…" : `Fix ${totalDiscrepancies} Error${totalDiscrepancies > 1 ? "s" : ""}`}
                </Button>
              )}
              <Button onClick={runCheck} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? "Analyzing…" : result ? "Re-run Check" : "Run Integrity Check"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Analyzing financial data…</p>
              <p className="text-sm text-muted-foreground mt-1">Recalculating balances and running AI audit</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts" className="gap-1.5">
              Accounts
              {result.summary.account_discrepancies > 0 && (
                <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-destructive text-white text-[10px] border-0">
                  {result.summary.account_discrepancies}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="loans" className="gap-1.5">
              Loans
              {result.summary.loan_discrepancies > 0 && (
                <Badge className="h-4 w-4 p-0 flex items-center justify-center bg-destructive text-white text-[10px] border-0">
                  {result.summary.loan_discrepancies}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ai-report">AI Report</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-4">
            {/* Transaction type totals */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: "Total Deposits", value: result.summary.grand_totals.deposits, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "Total Withdrawals", value: result.summary.grand_totals.withdrawals, icon: TrendingDown, color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Loan Disbursements", value: result.summary.grand_totals.loan_disbursements, icon: Banknote, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Loan Repayments", value: result.summary.grand_totals.loan_repayments, icon: CreditCard, color: "text-purple-500", bg: "bg-purple-500/10" },
                { label: "Welfare Deductions", value: result.summary.grand_totals.welfare_deductions, icon: PiggyBank, color: "text-rose-500", bg: "bg-rose-500/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="border-border/60">
                  <CardContent className="p-4">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", bg)}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{fmt(value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Balance integrity summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" /> Account Balance Integrity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Stored Total Balance", value: result.summary.balance_integrity.stored_total_balance },
                    { label: "Recalculated Balance", value: result.summary.balance_integrity.calculated_total_balance },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-semibold">{fmt(value)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Difference</span>
                    <DiscBadge val={result.summary.balance_integrity.balance_difference} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-primary" /> Savings Integrity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Stored Total Savings", value: result.summary.balance_integrity.stored_total_savings },
                    { label: "Recalculated Savings", value: result.summary.balance_integrity.calculated_total_savings },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-semibold">{fmt(value)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Difference</span>
                    <DiscBadge val={result.summary.balance_integrity.savings_difference} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {totalDiscrepancies === 0 && (
              <Alert className="border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                  All {result.summary.total_accounts} accounts and {result.summary.total_loans} loans passed integrity checks. No discrepancies found.
                </AlertDescription>
              </Alert>
            )}

            {totalDiscrepancies > 0 && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {totalDiscrepancies} discrepanc{totalDiscrepancies > 1 ? "ies" : "y"} detected. Click the <strong>"Fix Errors"</strong> button above to automatically correct stored values to match recalculated transaction totals.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground text-right">
              Generated: {new Date(result.generated_at).toLocaleString()}
            </p>
          </TabsContent>

          {/* ── ACCOUNTS TAB ── */}
          <TabsContent value="accounts">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Account Balance Reconciliation</CardTitle>
                <CardDescription className="text-xs">
                  Stored vs. recalculated balances for all {result.account_reports.length} accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Account</TableHead>
                        <TableHead className="text-xs text-right">Deposits</TableHead>
                        <TableHead className="text-xs text-right">Withdrawals</TableHead>
                        <TableHead className="text-xs text-right">Loan Disb.</TableHead>
                        <TableHead className="text-xs text-right">Loan Rep.</TableHead>
                        <TableHead className="text-xs text-right">Stored Bal.</TableHead>
                        <TableHead className="text-xs text-right">Calc. Bal.</TableHead>
                        <TableHead className="text-xs text-center">Bal. Diff</TableHead>
                        <TableHead className="text-xs text-center">Sav. Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.account_reports.map((acc) => {
                        const hasIssue = Math.abs(acc.balance_discrepancy) > 0.01 || Math.abs(acc.savings_discrepancy) > 0.01;
                        return (
                          <TableRow key={acc.account_id} className={cn(hasIssue && "bg-destructive/5")}>
                            <TableCell className="py-2">
                              <div>
                                <p className="text-xs font-semibold">{acc.owner_name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{acc.account_number}</p>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 mt-0.5">{acc.account_type}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono text-emerald-600">{fmt(acc.total_deposits)}</TableCell>
                            <TableCell className="text-right text-xs font-mono text-amber-600">{fmt(acc.total_withdrawals)}</TableCell>
                            <TableCell className="text-right text-xs font-mono text-blue-600">{fmt(acc.total_loan_disbursements)}</TableCell>
                            <TableCell className="text-right text-xs font-mono text-purple-600">{fmt(acc.total_loan_repayments)}</TableCell>
                            <TableCell className="text-right text-xs font-mono font-semibold">{fmt(acc.stored_balance)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{fmt(acc.calculated_balance)}</TableCell>
                            <TableCell className="text-center"><DiscBadge val={acc.balance_discrepancy} /></TableCell>
                            <TableCell className="text-center"><DiscBadge val={acc.savings_discrepancy} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LOANS TAB ── */}
          <TabsContent value="loans">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Loan Outstanding Balance Reconciliation</CardTitle>
                <CardDescription className="text-xs">
                  Stored vs. recalculated outstanding balances for all {result.loan_reports.length} loans
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Member</TableHead>
                        <TableHead className="text-xs text-right">Principal</TableHead>
                        <TableHead className="text-xs text-right">Total (w/ Interest)</TableHead>
                        <TableHead className="text-xs text-right">Total Repaid</TableHead>
                        <TableHead className="text-xs text-right">Stored Outstanding</TableHead>
                        <TableHead className="text-xs text-right">Calc. Outstanding</TableHead>
                        <TableHead className="text-xs text-center">Difference</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.loan_reports.map((loan) => {
                        const hasIssue = Math.abs(loan.discrepancy) > 0.01;
                        return (
                          <TableRow key={loan.loan_id} className={cn(hasIssue && "bg-destructive/5")}>
                            <TableCell className="py-2">
                              <div>
                                <p className="text-xs font-semibold">{loan.owner_name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{loan.account_number}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono">{fmt(loan.principal)}</TableCell>
                            <TableCell className="text-right text-xs font-mono font-semibold">{fmt(loan.total_amount)}</TableCell>
                            <TableCell className="text-right text-xs font-mono text-emerald-600">{fmt(loan.total_repaid)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{fmt(loan.stored_outstanding)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{fmt(loan.calculated_outstanding)}</TableCell>
                            <TableCell className="text-center"><DiscBadge val={loan.discrepancy} /></TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0",
                                  loan.status === "fully_paid" ? "border-emerald-500/40 text-emerald-600" :
                                  loan.status === "active" || loan.status === "disbursed" ? "border-blue-500/40 text-blue-600" :
                                  "border-muted-foreground/30 text-muted-foreground"
                                )}
                              >
                                {loan.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI REPORT TAB ── */}
          <TabsContent value="ai-report">
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  AI Audit Report
                </CardTitle>
                <CardDescription className="text-xs">
                  AI-generated analysis based on recalculated transaction data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-4 border border-border/60">
                    {result.ai_report}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
