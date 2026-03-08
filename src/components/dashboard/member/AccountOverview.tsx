import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, TrendingUp, TrendingDown, Wallet, CreditCard, Banknote, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface BalanceSummary {
  balance: number;
  total_savings: number;
  account_number: string;
}

interface TypeTotals {
  deposits: number;
  withdrawals: number;
  loan_disbursements: number;
  loan_repayments: number;
  welfare_deductions: number;
  interest_received: number;
}

interface RecentActivity {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  tnx_id: string;
}

const txLabel: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  loan_repayment: "Loan Repayment",
  loan_disbursement: "Loan Disbursed",
  welfare_deduction: "Welfare",
  interest_received: "Interest",
};

const txColor: Record<string, string> = {
  deposit: "text-success",
  withdrawal: "text-destructive",
  loan_repayment: "text-info",
  loan_disbursement: "text-warning",
  welfare_deduction: "text-muted-foreground",
  interest_received: "text-primary",
};

const fmt = (n: number) => `UGX ${Number(n).toLocaleString()}`;

const AccountOverview = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [totals, setTotals] = useState<TypeTotals>({
    deposits: 0, withdrawals: 0, loan_disbursements: 0,
    loan_repayments: 0, welfare_deductions: 0, interest_received: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) { setLoading(false); return; }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, balance, total_savings, account_number")
      .eq("user_id", user.id)
      .eq("account_type", "main")
      .maybeSingle();

    if (!account) { setLoading(false); return; }

    setSummary({ balance: account.balance, total_savings: account.total_savings, account_number: account.account_number });

    // Fetch all approved transactions for per-type totals
    const { data: allTxns } = await supabase
      .from("transactions")
      .select("transaction_type, amount, status, created_at, tnx_id, id")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false });

    if (allTxns) {
      const approved = allTxns.filter(t => t.status === "approved");
      const calcTotals: TypeTotals = {
        deposits: approved.filter(t => t.transaction_type === "deposit").reduce((s, t) => s + Number(t.amount), 0),
        withdrawals: approved.filter(t => t.transaction_type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0),
        loan_disbursements: approved.filter(t => t.transaction_type === "loan_disbursement").reduce((s, t) => s + Number(t.amount), 0),
        loan_repayments: approved.filter(t => t.transaction_type === "loan_repayment").reduce((s, t) => s + Number(t.amount), 0),
        welfare_deductions: approved.filter(t => t.transaction_type === "welfare_deduction").reduce((s, t) => s + Number(t.amount), 0),
        interest_received: approved.filter(t => t.transaction_type === "interest_received").reduce((s, t) => s + Number(t.amount), 0),
      };
      setTotals(calcTotals);
      setRecentActivity(allTxns.slice(0, 8));
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Balance breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">Available Balance</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(summary?.balance ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">{summary?.account_number}</p>
          </CardContent>
        </Card>
        <Card className="border-success/20 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <p className="text-xs text-muted-foreground">Total Savings</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(summary?.total_savings ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Cumulative approved deposits</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction type totals */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Transaction Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            { label: "Total Deposits",          value: totals.deposits,          icon: TrendingUp,   color: "text-success",          show: totals.deposits > 0 },
            { label: "Total Withdrawals",        value: totals.withdrawals,       icon: TrendingDown, color: "text-destructive",      show: totals.withdrawals > 0 },
            { label: "Loan Disbursements",       value: totals.loan_disbursements,icon: Banknote,     color: "text-warning",          show: totals.loan_disbursements > 0 },
            { label: "Loan Repayments Made",     value: totals.loan_repayments,   icon: CreditCard,   color: "text-info",             show: totals.loan_repayments > 0 },
            { label: "Welfare Deductions",       value: totals.welfare_deductions,icon: TrendingDown, color: "text-muted-foreground", show: totals.welfare_deductions > 0 },
            { label: "Interest Paid",            value: totals.interest_received, icon: TrendingDown, color: "text-purple-500",       show: totals.interest_received > 0 },
          ].filter(r => r.show).map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2">
                <Icon className={cn("w-3.5 h-3.5", color)} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <span className={cn("text-xs font-semibold font-mono tabular-nums", color)}>{fmt(value)}</span>
            </div>
          ))}
          {totals.deposits === 0 && totals.withdrawals === 0 && totals.loan_disbursements === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
          )}
          <Separator className="my-2" />
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-semibold text-foreground">Net Balance</span>
            <span className="text-xs font-bold font-mono tabular-nums text-foreground">{fmt(summary?.balance ?? 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-primary h-7 gap-1"
              onClick={() => navigate("/member/transactions")}>
              All <ArrowUpRight className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 px-4">No transactions yet</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                <div>
                  <p className={cn("text-xs font-medium", txColor[activity.transaction_type] || "text-foreground")}>
                    {txLabel[activity.transaction_type] || activity.transaction_type}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{activity.tnx_id} · {format(new Date(activity.created_at), "MMM dd, yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold tabular-nums">{fmt(activity.amount)}</p>
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] px-1.5 py-0 mt-0.5",
                      activity.status === "approved" ? "border-success/40 text-success" :
                      activity.status === "pending"  ? "border-warning/40 text-warning"  :
                      "border-destructive/40 text-destructive"
                    )}
                  >
                    {activity.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountOverview;
