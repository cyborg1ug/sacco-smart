import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, TrendingUp, Clock, Heart, BarChart3, CreditCard, FileText, Bell,
  ArrowUpRight, ArrowDownRight, AlertTriangle, PiggyBank, Wallet, Activity,
  RefreshCw, ArrowRight, CalendarRange,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  format, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subQuarters, subYears,
  eachMonthOfInterval, eachQuarterOfInterval, eachYearOfInterval,
} from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EnhancedMobileNavCard from "./EnhancedMobileNavCard";
import OverviewCharts from "./charts/OverviewCharts";

type Granularity = "month" | "quarter" | "year";

const periodKey = (d: Date, g: Granularity) =>
  g === "year" ? format(d, "yyyy")
    : g === "quarter" ? `${format(d, "yyyy")}-Q${Math.floor(d.getMonth() / 3) + 1}`
    : format(d, "yyyy-MM");

const periodLabel = (d: Date, g: Granularity) =>
  g === "year" ? format(d, "yyyy")
    : g === "quarter" ? `Q${Math.floor(d.getMonth() / 3) + 1} '${format(d, "yy")}`
    : format(d, "MMM yy");

const buildBuckets = (start: Date, end: Date, g: Granularity) => {
  if (end < start) return [];
  const dates = g === "year" ? eachYearOfInterval({ start, end })
    : g === "quarter" ? eachQuarterOfInterval({ start, end })
    : eachMonthOfInterval({ start, end });
  return dates.map((d) => ({ key: periodKey(d, g), label: periodLabel(d, g) }));
};

const resolveRange = (
  preset: string,
  customFrom?: string,
  customTo?: string,
  customGran: Granularity = "month",
): { start: Date; end: Date; g: Granularity } => {
  const now = new Date();
  switch (preset) {
    case "this_month": return { start: startOfMonth(now), end: endOfMonth(now), g: "month" };
    case "3m": return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now), g: "month" };
    case "12m": return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now), g: "month" };
    case "ytd": return { start: startOfYear(now), end: endOfMonth(now), g: "month" };
    case "quarterly": return { start: startOfQuarter(subQuarters(now, 3)), end: endOfQuarter(now), g: "quarter" };
    case "yearly": return { start: startOfYear(subYears(now, 2)), end: endOfYear(now), g: "year" };
    case "custom": {
      const start = customFrom ? startOfMonth(new Date(customFrom)) : startOfMonth(subMonths(now, 5));
      const end = customTo ? endOfMonth(new Date(customTo)) : endOfMonth(now);
      return { start, end, g: customGran };
    }
    case "6m":
    default: return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now), g: "month" };
  }
};


const fmtUGX = (n: number) =>
  n >= 1_000_000 ? `UGX ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `UGX ${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`
    : `UGX ${Math.round(n).toLocaleString()}`;

const fmtFull = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

const trendPct = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};

// ── Big stat card ────────────────────────────────────────────
interface BigStat {
  title: string; value: string; subtitle: string;
  icon: any; tone: "success" | "info" | "warning" | "primary";
  trend?: number; trendLabel?: string;
}
const toneMap = {
  success: { ring: "from-success/10", icon: "bg-success/15 text-success" },
  info:    { ring: "from-info/10",    icon: "bg-info/15 text-info" },
  warning: { ring: "from-warning/10", icon: "bg-warning/15 text-warning" },
  primary: { ring: "from-primary/10", icon: "bg-primary/15 text-primary" },
};
const BigStatCard = ({ stat, index }: { stat: BigStat; index: number }) => {
  const t = toneMap[stat.tone];
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className={cn("rounded-2xl border border-border/60 shadow-sm overflow-hidden bg-gradient-to-br to-transparent h-full", t.ring)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", t.icon)}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums mt-2 leading-tight">{stat.value}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{stat.subtitle}</p>
          {stat.trend !== undefined && (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-semibold",
              stat.trend >= 0 ? "text-success" : "text-destructive")}>
              {stat.trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{stat.trend >= 0 ? "+" : ""}{stat.trend}%</span>
              <span className="text-muted-foreground font-normal">{stat.trendLabel || "vs last month"}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    totalMembers: 0, activeMembers: 0, totalSavings: 0, activeLoans: 0,
    pendingTransactions: 0, pendingLoanApps: 0, totalLoanAmount: 0,
    outstandingBalance: 0, totalRepaid: 0, totalPenalties: 0,
    monthDeposits: 0, monthRepayments: 0, overdueCount: 0, overdueOutstanding: 0,
    depositsTrend: 0, loansTrend: 0, savingsTrend: 0, collectionTrend: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [charts, setCharts] = useState({
    memberContributions: [] as any[], loanDistribution: [] as any[],
  });
  // Raw time-series source data for period-aware charts
  const [rawTxns, setRawTxns] = useState<{ transaction_type: string; amount: number; created_at: string }[]>([]);
  const [rawSchedule, setRawSchedule] = useState<{ total_amount: number; repayment_months: number; disbursed_at: string }[]>([]);

  // Period controls
  const [period, setPeriod] = useState<string>("6m");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [customGran, setCustomGran] = useState<Granularity>("month");

  useEffect(() => {
    loadUserName();
    loadAll();
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "loans" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (data) setUserName(data.full_name);
    }
  };

  // Resolve account_id → member display name (main → profiles, sub → sub_account_profiles)
  const resolveNames = async (accountIds: string[]): Promise<Record<string, string>> => {
    const ids = [...new Set(accountIds.filter(Boolean))];
    const out: Record<string, string> = {};
    if (ids.length === 0) return out;
    const { data: accounts } = await supabase
      .from("accounts").select("id, account_number, user_id, account_type").in("id", ids);
    const mainUserIds = [...new Set((accounts || []).filter(a => a.account_type === "main").map(a => a.user_id).filter(Boolean))];
    const subIds = (accounts || []).filter(a => a.account_type === "sub").map(a => a.id);
    const [pRes, sRes] = await Promise.all([
      mainUserIds.length ? supabase.from("profiles").select("id, full_name").in("id", mainUserIds) : Promise.resolve({ data: [] }),
      subIds.length ? supabase.from("sub_account_profiles").select("account_id, full_name").in("account_id", subIds) : Promise.resolve({ data: [] }),
    ]);
    const pMap: Record<string, string> = {}; (pRes.data || []).forEach((p: any) => { pMap[p.id] = p.full_name; });
    const sMap: Record<string, string> = {}; (sRes.data || []).forEach((s: any) => { sMap[s.account_id] = s.full_name; });
    (accounts || []).forEach(a => {
      out[a.id] = a.account_type === "sub"
        ? (sMap[a.id] || a.account_number)
        : (pMap[a.user_id] || a.account_number);
    });
    return out;
  };

  const loadAll = async () => {
    await Promise.all([loadStatsAndCharts(), loadRecentTransactions(), loadPendingLoans()]);
  };

  const loadStatsAndCharts = async () => {
    const [accountsRes, allTxnsRes, activeLoansRes, pendingTxnRes, pendingLoanRes, loanAmtsRes, scheduleLoansRes] = await Promise.all([
      supabase.from("accounts").select("id, total_savings, account_type, user_id"),
      supabase.from("transactions").select("transaction_type, amount, created_at, account_id, loan_id").eq("status", "approved"),
      supabase.from("loans").select("id", { count: "exact" }).in("status", ["approved", "disbursed", "active"]).gt("outstanding_balance", 0),
      supabase.from("transactions").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("loans").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("loans").select("amount, outstanding_balance, status, purpose, disbursed_at, repayment_months").in("status", ["approved", "disbursed", "active"]),
      supabase.from("loans").select("total_amount, repayment_months, disbursed_at, status").in("status", ["disbursed", "active", "completed", "fully_paid"]).not("disbursed_at", "is", null),
    ]);

    const txns = allTxnsRes.data ?? [];
    const accounts = accountsRes.data ?? [];
    const mainAccounts = accounts.filter((a: any) => a.account_type === "main");
    // Total Savings = combined total_savings across all accounts (matches reports' "Combined Total Savings")
    const totalSavings = accounts.reduce((s: number, a: any) => s + Number(a.total_savings || 0), 0);
    const totalRepaid = txns.filter(t => t.transaction_type === "loan_repayment").reduce((s, t) => s + Number(t.amount), 0);
    const totalPenalties = txns.filter(t => t.transaction_type === "overdue_interest").reduce((s, t) => s + Number(t.amount), 0);
    const loans = loanAmtsRes.data ?? [];
    const totalLoanAmount = loans.reduce((s, l) => s + Number(l.amount), 0);
    const outstandingBalance = loans.reduce((s, l) => s + Number(l.outstanding_balance), 0);

    // Overdue loans
    const now = new Date();
    let overdueCount = 0, overdueOutstanding = 0;
    loans.forEach(l => {
      if (l.disbursed_at && l.repayment_months) {
        const end = new Date(l.disbursed_at); end.setMonth(end.getMonth() + l.repayment_months);
        if (now > end && Number(l.outstanding_balance) > 0) {
          overdueCount++; overdueOutstanding += Number(l.outstanding_balance);
        }
      }
    });

    // Active members (distinct main accounts with at least one approved transaction)
    const activeMembers = new Set(txns.map(t => t.account_id)).size;

    // Monthly buckets (last 6 months)
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(startOfMonth(now), 5 - i);
      return { key: format(d, "yyyy-MM"), label: format(d, "MMM") };
    });
    const bucket = () => months.reduce((acc, m) => { acc[m.key] = 0; return acc; }, {} as Record<string, number>);
    const deposits = bucket(), withdrawals = bucket(), disbursements = bucket(), collected = bucket(), expectedB = bucket();
    txns.forEach(t => {
      const k = format(new Date(t.created_at), "yyyy-MM");
      if (!(k in deposits)) return;
      const amt = Number(t.amount);
      if (t.transaction_type === "deposit") deposits[k] += amt;
      else if (t.transaction_type === "withdrawal") withdrawals[k] += amt;
      else if (t.transaction_type === "loan_disbursement") disbursements[k] += amt;
      else if (t.transaction_type === "loan_repayment") collected[k] += amt;
    });

    // Expected repayments = scheduled monthly installments due in each month.
    // For every disbursed loan, one installment (total_amount / repayment_months)
    // is expected each month from the month after disbursal through the term.
    const scheduleLoans = scheduleLoansRes.data ?? [];
    scheduleLoans.forEach((l: any) => {
      const months_ = Number(l.repayment_months);
      const total = Number(l.total_amount);
      if (!l.disbursed_at || !months_ || !total) return;
      const installment = total / months_;
      for (let i = 1; i <= months_; i++) {
        const due = startOfMonth(new Date(l.disbursed_at));
        due.setMonth(due.getMonth() + i);
        const dk = format(due, "yyyy-MM");
        if (dk in expectedB) expectedB[dk] += installment;
      }
    });

    // Store raw source data — period-aware time-series charts derive from these.
    setRawTxns(txns.map((t: any) => ({ transaction_type: t.transaction_type, amount: Number(t.amount), created_at: t.created_at })));
    setRawSchedule(scheduleLoans.map((l: any) => ({ total_amount: Number(l.total_amount), repayment_months: Number(l.repayment_months), disbursed_at: l.disbursed_at })));


    // Current vs previous month trends
    const curKey = months[5].key, prevKey = months[4].key;
    const disbThis = disbursements[curKey];
    const disbPrev = disbursements[prevKey];
    const monthDeposits = deposits[curKey];
    const monthRepayments = collected[curKey];

    // Member contributions — total savings by member (matches reports' per-member savings)
    const topAccounts = accounts
      .filter((a: any) => Number(a.total_savings || 0) > 0)
      .sort((a: any, b: any) => Number(b.total_savings) - Number(a.total_savings))
      .slice(0, 6);
    const nameMap = await resolveNames(topAccounts.map((a: any) => a.id));
    const memberContributions = topAccounts.map((a: any) => ({
      name: (nameMap[a.id] || "Member").split(" ").slice(0, 2).map((w, i) => i === 1 ? `${w[0]}.` : w).join(" "),
      amount: Number(a.total_savings),
    }));

    // Loan distribution by purpose
    const byPurpose: Record<string, number> = {};
    loans.forEach(l => {
      const p = (l.purpose && l.purpose.trim()) ? l.purpose.trim() : "General";
      byPurpose[p] = (byPurpose[p] || 0) + Number(l.amount);
    });
    const loanDistribution = Object.entries(byPurpose).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    setStats({
      totalMembers: mainAccounts.length,
      activeMembers: Math.min(activeMembers, mainAccounts.length || activeMembers),
      totalSavings, activeLoans: activeLoansRes.count || 0,
      pendingTransactions: pendingTxnRes.count || 0,
      pendingLoanApps: pendingLoanRes.count || 0,
      totalLoanAmount, outstandingBalance, totalRepaid, totalPenalties,
      monthDeposits, monthRepayments, overdueCount, overdueOutstanding,
      depositsTrend: trendPct(monthDeposits, deposits[prevKey]),
      loansTrend: trendPct(disbThis, disbPrev),
      savingsTrend: trendPct(monthDeposits, deposits[prevKey]),
      collectionTrend: trendPct(monthRepayments, collected[prevKey]),
    });
    setCharts({ memberContributions, loanDistribution });
  };

  const loadRecentTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select(`id, amount, transaction_type, status, created_at, tnx_id, balance_after, description,
        accounts!inner(id, account_number, user_id, account_type, parent_account_id)`)
      .order("created_at", { ascending: false }).limit(6);
    if (!data) return;
    const accIds = data.map(t => (t.accounts as any)?.id);
    const nameMap = await resolveNames(accIds);
    const enriched = data.map(tx => {
      const acc = tx.accounts as any;
      return { ...tx, accountName: nameMap[acc?.id] || acc?.account_number, accountNumber: acc?.account_number };
    });
    setRecentTransactions(enriched);
  };

  const loadPendingLoans = async () => {
    const { data } = await supabase
      .from("loans").select("id, amount, purpose, account_id, created_at")
      .eq("status", "pending").order("created_at", { ascending: false }).limit(5);
    if (!data) { setPendingLoans([]); return; }
    const nameMap = await resolveNames(data.map(l => l.account_id));
    setPendingLoans(data.map(l => ({ ...l, memberName: nameMap[l.account_id] || "Member" })));
  };

  const mobileNavItems = [
    { to: "/admin/members", icon: Users, title: "Members", description: "Manage member accounts" },
    { to: "/admin/transactions", icon: CreditCard, title: "Transactions", description: "View & approve transactions", badge: stats.pendingTransactions },
    { to: "/admin/loans", icon: TrendingUp, title: "Loans", description: "Manage loan applications" },
    { to: "/admin/welfare", icon: Heart, title: "Welfare", description: "Manage welfare fees" },
    { to: "/admin/reminders", icon: Bell, title: "Reminders", description: "Send alerts & notifications" },
    { to: "/admin/statements", icon: FileText, title: "Statements", description: "Generate member statements" },
    { to: "/admin/reports", icon: BarChart3, title: "Reports", description: "Financial reports & charts" },
  ];

  const txTypeColor: Record<string, string> = {
    deposit: "text-success", withdrawal: "text-destructive", loan_repayment: "text-info",
    loan_disbursement: "text-warning", interest_received: "text-primary", overdue_interest: "text-destructive",
  };
  const txTypeBg: Record<string, string> = {
    deposit: "bg-success/10", withdrawal: "bg-destructive/10", loan_repayment: "bg-info/10",
    loan_disbursement: "bg-warning/10", interest_received: "bg-primary/10", overdue_interest: "bg-destructive/10",
  };
  const txTypeIcon: Record<string, any> = {
    deposit: ArrowUpRight, withdrawal: ArrowDownRight, loan_repayment: RefreshCw,
    loan_disbursement: ArrowDownRight, interest_received: TrendingUp, overdue_interest: AlertTriangle,
  };
  const txTypeLabel: Record<string, string> = {
    deposit: "Deposit", withdrawal: "Withdrawal", loan_repayment: "Loan Repayment",
    loan_disbursement: "Disbursement", interest_received: "Interest", overdue_interest: "Overdue Penalty",
  };
  const isInflow = (t: string) => t === "deposit" || t === "loan_repayment" || t === "interest_received";

  const collectionRate = stats.totalLoanAmount > 0
    ? Math.round((stats.totalRepaid / (stats.totalRepaid + stats.outstandingBalance || 1)) * 100) : 0;

  const bigStats: BigStat[] = [
    { title: "Total Savings", value: fmtFull(stats.totalSavings), subtitle: "Across all member accounts", icon: PiggyBank, tone: "success", trend: stats.savingsTrend },
    { title: "Total Loans Issued", value: fmtFull(stats.totalLoanAmount), subtitle: `${stats.activeLoans} active loan accounts`, icon: CreditCard, tone: "info", trend: stats.loansTrend },
    { title: "Outstanding Loans", value: fmtFull(stats.outstandingBalance), subtitle: `Collection rate: ${collectionRate}%`, icon: Wallet, tone: "warning", trend: stats.collectionTrend, trendLabel: "collection" },
    { title: "Active Members", value: `${stats.activeMembers}/${stats.totalMembers}`, subtitle: `${stats.pendingLoanApps} pending applications`, icon: Users, tone: "success", trend: stats.depositsTrend },
  ];

  const smallStats = [
    { label: "Monthly Deposits", value: fmtFull(stats.monthDeposits), icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" },
    { label: "Monthly Repayments", value: fmtFull(stats.monthRepayments), icon: RefreshCw, color: "text-info", bg: "bg-info/10" },
    { label: "Overdue Loans", value: `${stats.overdueCount} loans`, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Penalties Collected", value: fmtFull(stats.totalPenalties), icon: Activity, color: "text-warning", bg: "bg-warning/10" },
  ];

  // ── Period-aware time-series (repayment trends + savings activity) ──
  const { repaymentTrends, savingsActivity, periodDescription } = useMemo(() => {
    const { start, end, g } = resolveRange(period, customFrom, customTo, customGran);
    const buckets = buildBuckets(start, end, g);
    const zero = () => buckets.reduce((acc, b) => { acc[b.key] = 0; return acc; }, {} as Record<string, number>);
    const deposits = zero(), withdrawals = zero(), collected = zero(), expected = zero();

    rawTxns.forEach((t) => {
      const d = new Date(t.created_at);
      if (d < start || d > end) return;
      const k = periodKey(d, g);
      if (!(k in deposits)) return;
      if (t.transaction_type === "deposit") deposits[k] += t.amount;
      else if (t.transaction_type === "withdrawal") withdrawals[k] += t.amount;
      else if (t.transaction_type === "loan_repayment" || t.transaction_type === "interest_received") collected[k] += t.amount;
    });

    rawSchedule.forEach((l) => {
      if (!l.disbursed_at || !l.repayment_months || !l.total_amount) return;
      const installment = l.total_amount / l.repayment_months;
      for (let i = 1; i <= l.repayment_months; i++) {
        const due = startOfMonth(new Date(l.disbursed_at));
        due.setMonth(due.getMonth() + i);
        if (due < start || due > end) continue;
        const k = periodKey(due, g);
        if (k in expected) expected[k] += installment;
      }
    });

    // Bank-style arrears: cumulative unpaid balance carried forward per bucket.
    let arrears = 0;
    const repaymentTrends = buckets.map((b) => {
      arrears = Math.max(arrears + expected[b.key] - collected[b.key], 0);
      return {
        month: b.label,
        expected: Math.round(expected[b.key]),
        collected: Math.round(collected[b.key]),
        overdue: Math.round(arrears),
      };
    });

    const savingsActivity = buckets.map((b) => ({
      month: b.label,
      deposits: Math.round(deposits[b.key]),
      withdrawals: Math.round(withdrawals[b.key]),
    }));
    const periodDescription = `${format(start, "dd MMM yyyy")} – ${format(end, "dd MMM yyyy")} · ${g}ly`;
    return { repaymentTrends, savingsActivity, periodDescription };
  }, [rawTxns, rawSchedule, period, customFrom, customTo, customGran]);

  const periodOptions = [
    { value: "this_month", label: "This Month" },
    { value: "3m", label: "Last 3 Months" },
    { value: "6m", label: "Last 6 Months" },
    { value: "12m", label: "Last 12 Months" },
    { value: "ytd", label: "This Year (Monthly)" },
    { value: "quarterly", label: "Quarterly (Last 4Q)" },
    { value: "yearly", label: "Yearly (Last 3Y)" },
    { value: "custom", label: "Custom Range…" },
  ];

  return (
    <DashboardLayout isAdmin userName={userName} pendingCount={stats.pendingTransactions}>
      {/* Heading */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}. Here's your SACCO overview.
          </p>
        </div>
        {stats.pendingTransactions > 0 && (
          <Button size="sm" variant="outline" className="gap-2 border-warning/40 text-warning hover:bg-warning/5"
            onClick={() => navigate("/admin/transactions")}>
            <Clock className="w-3.5 h-3.5" />{stats.pendingTransactions} Pending
          </Button>
        )}
      </div>

      {/* Overdue alert banner */}
      {stats.overdueCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm font-medium text-destructive truncate">
              {stats.overdueCount} loan{stats.overdueCount > 1 ? "s are" : " is"} overdue — outstanding balance of {fmtFull(stats.overdueOutstanding)}
            </p>
          </div>
          <button onClick={() => navigate("/admin/loans")}
            className="flex items-center gap-1 text-xs font-semibold text-destructive hover:underline shrink-0">
            View defaulters <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* Big stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-4">
        {bigStats.map((s, i) => <BigStatCard key={s.title} stat={s} index={i} />)}
      </div>

      {/* Small stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {smallStats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}>
              <Card className="rounded-2xl border border-border/60 shadow-sm">
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                    <Icon className={cn("w-4 h-4", s.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
                    <p className="text-sm font-bold tabular-nums text-foreground truncate">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }} className="mb-6 space-y-4">
        {/* Period controls */}
        <Card className="rounded-2xl border border-border/60 shadow-sm">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarRange className="w-4 h-4 text-primary" />
              <span>Time period</span>
              <span className="text-xs font-normal text-muted-foreground hidden sm:inline">· {periodDescription}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:w-56">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">From</Label>
                    <Input type="month" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[140px]" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">To</Label>
                    <Input type="month" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[140px]" />
                  </div>
                  <div className="w-[130px]">
                    <Label className="text-[10px] text-muted-foreground">Group by</Label>
                    <Select value={customGran} onValueChange={(v) => setCustomGran(v as Granularity)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="quarter">Quarterly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <OverviewCharts
          repaymentTrends={repaymentTrends}
          savingsActivity={savingsActivity}
          memberContributions={charts.memberContributions}
          loanDistribution={charts.loanDistribution}
        />
      </motion.div>


      {/* Recent transactions + Pending loan applications */}
      <div className="grid gap-5 lg:grid-cols-2 mb-6">
        <Card className="rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Recent Transactions</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Latest financial activity</p>
              </div>
              <button onClick={() => navigate("/admin/transactions")}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-0">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
            ) : recentTransactions.map(tx => {
              const Icon = txTypeIcon[tx.transaction_type] || ArrowUpRight;
              const inflow = isInflow(tx.transaction_type);
              return (
                <div key={tx.id} onClick={() => navigate("/admin/transactions")}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", txTypeBg[tx.transaction_type] || "bg-muted")}>
                      <Icon className={cn("w-4 h-4", txTypeColor[tx.transaction_type] || "text-foreground")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.accountName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tx.description || txTypeLabel[tx.transaction_type] || tx.transaction_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold tabular-nums", inflow ? "text-success" : "text-destructive")}>
                      {inflow ? "+" : "-"}{fmtFull(Number(tx.amount))}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(tx.created_at), "yyyy-MM-dd")}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Pending Loan Applications</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{stats.pendingLoanApps} awaiting approval</p>
              </div>
              <button onClick={() => navigate("/admin/loans")}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Review <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-0">
            {pendingLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pending applications</p>
            ) : pendingLoans.map(l => (
              <div key={l.id} onClick={() => navigate("/admin/loans")}
                className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-warning/10">
                    <Clock className="w-4 h-4 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{l.memberName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(l.purpose && l.purpose.trim()) || "General"} · LN-{l.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums text-foreground">{fmtFull(Number(l.amount))}</p>
                  <Badge variant="outline" className="badge-pending text-[10px] px-1.5 py-0 mt-0.5">Pending</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Mobile quick navigation */}
      {isMobile && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Management</h2>
          {mobileNavItems.map((item, index) => (
            <EnhancedMobileNavCard key={item.to} to={item.to} icon={item.icon}
              title={item.title} description={item.description} badge={item.badge} index={index} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
