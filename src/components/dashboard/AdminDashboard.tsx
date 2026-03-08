import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, DollarSign, TrendingUp, Clock, Heart, BarChart3,
  CreditCard, FileText, Bell, ArrowUpRight, Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FinStatCard from "./FinStatCard";
import MembersManagement from "./admin/MembersManagement";
import TransactionsManagement from "./admin/TransactionsManagement";
import LoansManagement from "./admin/LoansManagement";
import StatementsGeneration from "./admin/StatementsGeneration";
import ReportsGeneration from "./admin/ReportsGeneration";
import AlertsReminders from "./admin/AlertsReminders";
import WelfareManagement from "./admin/WelfareManagement";
import LoanCompletionChart from "./charts/LoanCompletionChart";
import EnhancedMobileNavCard from "./EnhancedMobileNavCard";

const AdminDashboard = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalSavings: 0,
    activeLoans: 0,
    pendingTransactions: 0,
    totalLoanAmount: 0,
    outstandingBalance: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("members");

  useEffect(() => {
    loadUserName();
    loadStats();
    loadRecentTransactions();

    // Real-time: reload stats whenever any transaction changes (especially approvals)
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        loadStats();
        loadRecentTransactions();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "loans" }, () => {
        loadStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        loadStats();
      })
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

  const loadStats = async () => {
    const [accountsRes, allTxnsRes, loansRes, pendingRes, loanAmtsRes] = await Promise.all([
      // Only count main accounts as "members"
      supabase.from("accounts").select("id", { count: "exact" }).eq("account_type", "main"),
      // Fetch all approved transactions for per-type recalculation
      supabase.from("transactions").select("transaction_type, amount").eq("status", "approved"),
      supabase.from("loans").select("id", { count: "exact" }).in("status", ["approved", "disbursed", "active"]).gt("outstanding_balance", 0),
      supabase.from("transactions").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("loans").select("amount, outstanding_balance").in("status", ["approved", "disbursed", "active"]),
    ]);

    const txns = allTxnsRes.data ?? [];
    // Recalculate from transaction history (source of truth)
    const totalSavings = txns.filter(t => t.transaction_type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
    const totalLoanAmount = loanAmtsRes.data?.reduce((s, l) => s + Number(l.amount), 0) || 0;
    const outstandingBalance = loanAmtsRes.data?.reduce((s, l) => s + Number(l.outstanding_balance), 0) || 0;

    setStats({
      totalMembers: accountsRes.count || 0,
      totalSavings,
      activeLoans: loansRes.count || 0,
      pendingTransactions: pendingRes.count || 0,
      totalLoanAmount,
      outstandingBalance,
    });
  };

  const loadRecentTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select(`
        id, amount, transaction_type, status, created_at, tnx_id, balance_after, description,
        accounts!inner(id, account_number, user_id, account_type, parent_account_id)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!data) return;

    // Resolve account names: main accounts → profiles, sub-accounts → sub_account_profiles
    const mainUserIds = [...new Set(
      data.filter(t => (t.accounts as any)?.account_type === "main")
          .map(t => (t.accounts as any)?.user_id).filter(Boolean)
    )];
    const subAccountIds = [...new Set(
      data.filter(t => (t.accounts as any)?.account_type === "sub")
          .map(t => (t.accounts as any)?.id).filter(Boolean)
    )];

    const [profilesRes, subProfilesRes] = await Promise.all([
      mainUserIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", mainUserIds)
        : Promise.resolve({ data: [] }),
      subAccountIds.length > 0
        ? supabase.from("sub_account_profiles").select("account_id, full_name").in("account_id", subAccountIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap: Record<string, string> = {};
    (profilesRes.data || []).forEach(p => { profileMap[p.id] = p.full_name; });
    const subProfileMap: Record<string, string> = {};
    (subProfilesRes.data || []).forEach(s => { subProfileMap[s.account_id] = s.full_name; });

    const enriched = data.map(tx => {
      const acc = tx.accounts as any;
      let accountName = acc?.account_number;
      if (acc?.account_type === "main" && acc?.user_id) {
        accountName = profileMap[acc.user_id] || acc.account_number;
      } else if (acc?.account_type === "sub") {
        accountName = subProfileMap[acc.id] || acc.account_number;
      }
      return { ...tx, accountName, accountNumber: acc?.account_number };
    });

    setRecentTransactions(enriched);
  };

  const mobileNavItems = [
    { to: "/admin/members",      icon: Users,    title: "Members",      description: "Manage member accounts" },
    { to: "/admin/transactions", icon: CreditCard, title: "Transactions", description: "View & approve transactions", badge: stats.pendingTransactions },
    { to: "/admin/loans",        icon: TrendingUp, title: "Loans",        description: "Manage loan applications" },
    { to: "/admin/welfare",      icon: Heart,    title: "Welfare",      description: "Manage welfare fees" },
    { to: "/admin/reminders",    icon: Bell,     title: "Reminders",    description: "Send alerts & notifications" },
    { to: "/admin/statements",   icon: FileText, title: "Statements",   description: "Generate member statements" },
    { to: "/admin/reports",      icon: BarChart3, title: "Reports",     description: "Financial reports & charts" },
  ];

  const formatCurrency = (n: number) =>
    n >= 1_000_000
      ? `UGX ${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `UGX ${(n / 1_000).toFixed(0)}K`
      : `UGX ${n.toLocaleString()}`;

  const txTypeColor: Record<string, string> = {
    deposit:           "text-success",
    withdrawal:        "text-destructive",
    loan_repayment:    "text-info",
    loan_disbursement: "text-warning",
    interest_received: "text-primary",
    overdue_interest:  "text-destructive",
  };
  const txTypeBg: Record<string, string> = {
    deposit:           "bg-success/10",
    withdrawal:        "bg-destructive/10",
    loan_repayment:    "bg-info/10",
    loan_disbursement: "bg-warning/10",
    interest_received: "bg-primary/10",
    overdue_interest:  "bg-destructive/10",
  };
  const txTypeLabel: Record<string, string> = {
    deposit:           "Deposit",
    withdrawal:        "Withdrawal",
    loan_repayment:    "Loan Repayment",
    loan_disbursement: "Disbursement",
    interest_received: "Interest",
    overdue_interest:  "Overdue Penalty",
  };

  return (
    <DashboardLayout
      isAdmin
      userName={userName}
      pendingCount={stats.pendingTransactions}
    >
      {/* Page heading */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}. Here's what's happening.
          </p>
        </div>
        {stats.pendingTransactions > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-warning/40 text-warning hover:bg-warning/5"
            onClick={() => { if (!isMobile) setActiveTab("transactions"); else navigate("/admin/transactions"); }}
          >
            <Clock className="w-3.5 h-3.5" />
            {stats.pendingTransactions} Pending
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <FinStatCard title="Total Members"      value={stats.totalMembers}                    subtitle="Active accounts"       icon={Users}      variant="primary"     index={0} />
        <FinStatCard title="Total Savings"      value={formatCurrency(stats.totalSavings)}    subtitle="All approved deposits"  icon={DollarSign}  variant="success"    index={1} />
        <FinStatCard title="Active Loans"       value={stats.activeLoans}                     subtitle="In progress"            icon={TrendingUp}  variant="info"        index={2} />
        <FinStatCard title="Pending Approvals"  value={stats.pendingTransactions}             subtitle="Awaiting review"        icon={Clock}      variant={stats.pendingTransactions > 0 ? "warning" : "default"} highlighted={stats.pendingTransactions > 0} index={3} />
      </div>

      {/* Second row — financial depth */}
      <div className="grid gap-4 grid-cols-2 mb-6">
        <FinStatCard title="Loans Issued"        value={formatCurrency(stats.totalLoanAmount)} subtitle="Total principal"  icon={CreditCard}  variant="primary"  index={4} />
        <FinStatCard title="Outstanding Balance" value={formatCurrency(stats.outstandingBalance)} subtitle="Remaining to collect" icon={Activity} variant={stats.outstandingBalance > 0 ? "warning" : "success"} index={5} />
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="mb-6"
      >
        <LoanCompletionChart isAdmin />
      </motion.div>

      {/* Mobile: Nav cards / Desktop: full tabs */}
      {isMobile ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-4"
        >
          {/* Recent Transactions mini card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-primary h-7 gap-1" onClick={() => navigate("/admin/transactions")}>
                  View all <ArrowUpRight className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {recentTransactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center ${txTypeBg[tx.transaction_type] || "bg-muted"}`}>
                      <DollarSign className={`w-3.5 h-3.5 ${txTypeColor[tx.transaction_type] || "text-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${txTypeColor[tx.transaction_type] || "text-foreground"}`}>
                        {txTypeLabel[tx.transaction_type] || tx.transaction_type}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{tx.accountName}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs font-bold tabular-nums">UGX {Number(tx.amount).toLocaleString()}</p>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${tx.status === "approved" ? "badge-approved" : tx.status === "pending" ? "badge-pending" : "badge-rejected"}`}>
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <h2 className="text-sm font-semibold text-foreground">Management</h2>
          <div className="space-y-3">
            {mobileNavItems.map((item, index) => (
              <EnhancedMobileNavCard
                key={item.to}
                to={item.to}
                icon={item.icon}
                title={item.title}
                description={item.description}
                badge={item.badge}
                index={index}
              />
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
        >
          {/* Main Tabs Area */}
          <div className="xl:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/60 rounded-xl mb-4">
                {[
                  { value: "members",      icon: Users,       label: "Members" },
                  { value: "transactions", icon: CreditCard,  label: "Transactions", badge: stats.pendingTransactions },
                  { value: "loans",        icon: TrendingUp,  label: "Loans" },
                  { value: "welfare",      icon: Heart,       label: "Welfare" },
                  { value: "reminders",    icon: Bell,        label: "Reminders" },
                  { value: "statements",   icon: FileText,    label: "Statements" },
                  { value: "reports",      icon: BarChart3,   label: "Reports" },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="ml-1 bg-destructive text-white rounded-full px-1.5 py-0 text-[10px] font-bold">
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="members">     <MembersManagement /></TabsContent>
              <TabsContent value="transactions"><TransactionsManagement onUpdate={loadStats} /></TabsContent>
              <TabsContent value="loans">       <LoansManagement onUpdate={loadStats} /></TabsContent>
              <TabsContent value="welfare">     <WelfareManagement /></TabsContent>
              <TabsContent value="reminders">   <AlertsReminders /></TabsContent>
              <TabsContent value="statements">  <StatementsGeneration /></TabsContent>
              <TabsContent value="reports">     <ReportsGeneration /></TabsContent>
            </Tabs>
          </div>

          {/* Right Panel — Recent Transactions */}
          <div className="xl:col-span-1">
            <Card className="sticky top-0">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary h-7 gap-1"
                    onClick={() => setActiveTab("transactions")}
                  >
                    View all <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  <div>
                    {recentTransactions.map(tx => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setActiveTab("transactions")}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            tx.transaction_type === "deposit" ? "bg-success/10" :
                            tx.transaction_type === "withdrawal" ? "bg-destructive/10" :
                            tx.transaction_type === "loan_repayment" ? "bg-info/10" :
                            "bg-warning/10"
                          }`}>
                            <DollarSign className={`w-4 h-4 ${txTypeColor[tx.transaction_type] || "text-foreground"}`} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {txTypeLabel[tx.transaction_type] || tx.transaction_type}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">{tx.tnx_id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold tabular-nums text-foreground">
                            UGX {Number(tx.amount).toLocaleString()}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ${
                              tx.status === "approved" ? "badge-approved" :
                              tx.status === "pending"  ? "badge-pending"  : "badge-rejected"
                            }`}
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
