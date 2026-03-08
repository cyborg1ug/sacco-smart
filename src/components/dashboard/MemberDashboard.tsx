import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet, TrendingUp, History, Users, Eye, PlusCircle, CreditCard,
  Shield, PiggyBank, Bell, FileText, UsersRound, User,
  ToggleLeft, ToggleRight, ArrowUpRight, Activity,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FinStatCard from "./FinStatCard";
import EnhancedMobileNavCard from "./EnhancedMobileNavCard";
import AccountOverview from "./member/AccountOverview";
import TransactionHistory from "./member/TransactionHistory";
import LoanApplication from "./member/LoanApplication";
import SavingsTracker from "./member/SavingsTracker";
import MemberStatement from "./member/MemberStatement";
import MemberReminders from "./member/MemberReminders";
import RecordTransaction from "./member/RecordTransaction";
import GuarantorRequests from "./member/GuarantorRequests";
import ProfileManagement from "./member/ProfileManagement";
import SubAccountsManager from "./member/SubAccountsManager";
import LoanCompletionChart from "./charts/LoanCompletionChart";
import LoanRepaymentSchedule from "./member/LoanRepaymentSchedule";

interface AccountData {
  id: string; balance: number; total_savings: number; account_number: string;
}
interface SubAccountData {
  id: string; balance: number; total_savings: number; account_number: string;
  profile: { full_name: string } | null;
}

const MemberDashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [subAccounts, setSubAccounts] = useState<SubAccountData[]>([]);
  const [jointTotals, setJointTotals] = useState({ balance: 0, total_savings: 0 });
  const [activeLoans, setActiveLoans] = useState(0);
  const [pendingGuarantorRequests, setPendingGuarantorRequests] = useState(0);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [hasSubAccounts, setHasSubAccounts] = useState(false);
  const [showJointView, setShowJointView] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => { loadAccountData(); }, []);

  const loadAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    if (profileData) setUserName(profileData.full_name);

    const { data: accountData } = await supabase
      .from("accounts")
      .select("id, balance, total_savings, account_number")
      .eq("user_id", user.id).eq("account_type", "main").maybeSingle();

    if (!accountData) return;
    setAccount(accountData);

    // Sub-accounts
    const { data: subAccountsData } = await supabase
      .from("accounts")
      .select("id, balance, total_savings, account_number")
      .eq("parent_account_id", accountData.id).eq("account_type", "sub");

    if (subAccountsData && subAccountsData.length > 0) {
      setHasSubAccounts(true);
      const { data: subProfiles } = await supabase
        .from("sub_account_profiles")
        .select("account_id, full_name")
        .in("account_id", subAccountsData.map(a => a.id));
      const profilesMap = new Map(subProfiles?.map(p => [p.account_id, p]) || []);
      setSubAccounts(subAccountsData.map(sa => ({ ...sa, profile: profilesMap.get(sa.id) || null })));
      setJointTotals({
        balance: accountData.balance + subAccountsData.reduce((s, sa) => s + Number(sa.balance), 0),
        total_savings: accountData.total_savings + subAccountsData.reduce((s, sa) => s + Number(sa.total_savings), 0),
      });
    } else {
      setHasSubAccounts(false);
      setSubAccounts([]);
      setJointTotals({ balance: accountData.balance, total_savings: accountData.total_savings });
    }

    const allAccountIds = [accountData.id, ...(subAccountsData?.map(sa => sa.id) || [])];

    // Build account name map: accountId → display name
    const accountNameMap: Record<string, string> = { [accountData.id]: userName || "Main Account" };
    if (subAccountsData && subAccountsData.length > 0) {
      const { data: subProfiles2 } = await supabase
        .from("sub_account_profiles").select("account_id, full_name")
        .in("account_id", subAccountsData.map(sa => sa.id));
      subProfiles2?.forEach(p => { accountNameMap[p.account_id] = p.full_name; });
    }

    const [loansRes, guarantorRes, txRes] = await Promise.all([
      supabase.from("loans").select("id", { count: "exact" }).in("account_id", allAccountIds).in("status", ["approved", "disbursed"]),
      (supabase.from("loans").select("id", { count: "exact" }) as any).in("guarantor_account_id", allAccountIds).eq("guarantor_status", "pending"),
      supabase.from("transactions").select("id, amount, transaction_type, status, created_at, tnx_id, account_id, balance_after")
        .in("account_id", allAccountIds).order("created_at", { ascending: false }).limit(6),
    ]);

    setActiveLoans(loansRes.count || 0);
    setPendingGuarantorRequests(guarantorRes.count || 0);
    if (txRes.data) {
      setRecentTransactions(txRes.data.map(tx => ({
        ...tx,
        account_name: accountNameMap[tx.account_id] || "Account",
      })));
    }
  };

  const displayBalance = showJointView ? jointTotals.balance : (account?.balance || 0);
  const displaySavings = showJointView ? jointTotals.total_savings : (account?.total_savings || 0);

  const txTypeColor: Record<string, string> = {
    deposit: "text-success", withdrawal: "text-destructive",
    loan_repayment: "text-info", loan_disbursement: "text-warning",
  };
  const txTypeLabel: Record<string, string> = {
    deposit: "Deposit", withdrawal: "Withdrawal",
    loan_repayment: "Repayment", loan_disbursement: "Disbursement",
  };

  const mobileNavItems = [
    { to: "/member/overview",           icon: Eye,       title: "Overview",         description: "View recent activity" },
    { to: "/member/record-transaction", icon: PlusCircle,title: "Record",           description: "Deposit or repay loan" },
    { to: "/member/transactions",       icon: History,   title: "Transactions",     description: "Full history" },
    { to: "/member/loan-application",   icon: CreditCard,title: "Loans",            description: "Apply for a loan" },
    { to: "/member/guarantor-requests", icon: Shield,    title: "Guarantor",        description: "Approve loan guarantees", badge: pendingGuarantorRequests },
    { to: "/member/savings",            icon: PiggyBank, title: "Savings",          description: "Track your savings" },
    { to: "/member/reminders",          icon: Bell,      title: "Reminders",        description: "View notifications" },
    { to: "/member/statement",          icon: FileText,  title: "Statement",        description: "Download statements" },
    ...(hasSubAccounts ? [{ to: "/member/sub-accounts", icon: UsersRound, title: "Sub-Accounts", description: "Manage linked accounts" }] : []),
    { to: "/member/profile",            icon: User,      title: "Profile",          description: "Update your info" },
  ];

  const tabDef = [
    { value: "overview",     icon: Eye,        label: "Overview" },
    { value: "record",       icon: PlusCircle, label: "Record" },
    { value: "transactions", icon: History,    label: "History" },
    { value: "loans",        icon: CreditCard, label: "Loan" },
    { value: "guarantor",    icon: Shield,     label: "Guarantor", badge: pendingGuarantorRequests },
    { value: "savings",      icon: PiggyBank,  label: "Savings" },
    { value: "reminders",    icon: Bell,       label: "Reminders" },
    { value: "statement",    icon: FileText,   label: "Statement" },
    ...(hasSubAccounts ? [{ value: "subaccounts", icon: UsersRound, label: "Sub-Accounts" }] : []),
    { value: "profile",      icon: User,       label: "Profile" },
  ];

  return (
    <DashboardLayout
      isAdmin={false}
      userName={userName}
      accountNumber={account?.account_number}
      pendingGuarantor={pendingGuarantorRequests}
      hasSubAccounts={hasSubAccounts}
    >
      {/* Page heading */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {userName ? `Hello, ${userName.split(" ")[0]}` : "My Dashboard"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {account?.account_number ? `Account ${account.account_number}` : "Your financial overview"}
          </p>
        </div>

        {/* Joint / Main toggle */}
        {hasSubAccounts && (
          <div className="flex items-center gap-2 bg-card border rounded-xl px-3 py-2 shadow-sm">
            <span className={`text-xs font-medium ${!showJointView ? "text-foreground" : "text-muted-foreground"}`}>Main</span>
            <Button variant="ghost" size="sm" className="p-0 h-6 hover:bg-transparent" onClick={() => setShowJointView(!showJointView)}>
              {showJointView
                ? <ToggleRight className="h-6 w-6 text-primary" />
                : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
            </Button>
            <span className={`text-xs font-medium ${showJointView ? "text-foreground" : "text-muted-foreground"}`}>Joint</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <FinStatCard
          title={showJointView ? "Joint Balance" : "Balance"}
          value={`UGX ${displayBalance.toLocaleString()}`}
          subtitle={showJointView ? "All accounts" : "Main account"}
          icon={Wallet} variant="primary" highlighted={showJointView} index={0}
        />
        <FinStatCard
          title={showJointView ? "Joint Savings" : "Total Savings"}
          value={`UGX ${displaySavings.toLocaleString()}`}
          subtitle={showJointView ? "Combined" : "Main savings"}
          icon={TrendingUp} variant="success" highlighted={showJointView} index={1}
        />
        <FinStatCard
          title="Active Loans" value={activeLoans} subtitle="In progress"
          icon={Activity} variant="info" index={2}
        />
        <FinStatCard
          title="Guarantor Requests" value={pendingGuarantorRequests} subtitle="Pending review"
          icon={Users} variant={pendingGuarantorRequests > 0 ? "warning" : "default"}
          highlighted={pendingGuarantorRequests > 0} index={3}
        />
      </div>

      {/* Sub-Account mini cards (desktop only) */}
      {hasSubAccounts && subAccounts.length > 0 && !isMobile && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6"
        >
          {subAccounts.map(subAcc => (
            <Card key={subAcc.id} className="border-dashed hover:border-primary/40 transition-colors card-hover">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    {subAcc.profile?.full_name || subAcc.account_number}
                  </p>
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                    <Users className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm font-bold tabular-nums">UGX {Number(subAcc.balance).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Savings: UGX {Number(subAcc.total_savings).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Charts */}
      {account && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="mb-6 space-y-4"
        >
          <LoanCompletionChart accountIds={[account.id, ...subAccounts.map(sa => sa.id)]} />
          <LoanRepaymentSchedule accountIds={[account.id, ...subAccounts.map(sa => sa.id)]} />
        </motion.div>
      )}

      {/* Mobile nav cards / Desktop tabs */}
      {isMobile ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="space-y-4"
        >
          {/* Recent transactions card */}
          {recentTransactions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-primary h-7 gap-1" onClick={() => navigate("/member/transactions")}>
                    All <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentTransactions.slice(0, 4).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div>
                      <p className={`text-xs font-medium ${txTypeColor[tx.transaction_type] || "text-foreground"}`}>
                        {txTypeLabel[tx.transaction_type] || tx.transaction_type}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{tx.account_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">UGX {Number(tx.amount).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">Bal: {Number(tx.balance_after).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
          <div className="space-y-3">
            {mobileNavItems.map((item, index) => (
              <EnhancedMobileNavCard
                key={item.to} to={item.to} icon={item.icon}
                title={item.title} description={item.description}
                badge={item.badge} index={index}
              />
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
        >
          {/* Main Tabs */}
          <div className="xl:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/60 rounded-xl mb-4">
                {tabDef.map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                    {(tab as any).badge !== undefined && (tab as any).badge > 0 && (
                      <span className="ml-1 bg-destructive text-white rounded-full px-1.5 py-0 text-[10px] font-bold">
                        {(tab as any).badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">     <AccountOverview /></TabsContent>
              <TabsContent value="record">       <RecordTransaction onTransactionRecorded={loadAccountData} /></TabsContent>
              <TabsContent value="transactions"> <TransactionHistory /></TabsContent>
              <TabsContent value="loans">        <LoanApplication onApplicationSubmitted={loadAccountData} /></TabsContent>
              <TabsContent value="guarantor">    <GuarantorRequests /></TabsContent>
              <TabsContent value="savings">      <SavingsTracker /></TabsContent>
              <TabsContent value="reminders">    <MemberReminders /></TabsContent>
              <TabsContent value="statement">    <MemberStatement /></TabsContent>
              {hasSubAccounts && account && (
                <TabsContent value="subaccounts"><SubAccountsManager parentAccountId={account.id} /></TabsContent>
              )}
              <TabsContent value="profile">      <ProfileManagement /></TabsContent>
            </Tabs>
          </div>

          {/* Right Panel — Recent Activity */}
          <div className="xl:col-span-1">
            <Card className="sticky top-0">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-primary h-7 gap-1" onClick={() => setActiveTab("transactions")}>
                    All <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  recentTransactions.map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setActiveTab("transactions")}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.transaction_type === "deposit" ? "bg-success/10" :
                          tx.transaction_type === "withdrawal" ? "bg-destructive/10" :
                          tx.transaction_type === "loan_repayment" ? "bg-info/10" : "bg-warning/10"
                        }`}>
                          <Wallet className={`w-4 h-4 ${txTypeColor[tx.transaction_type] || "text-foreground"}`} />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{txTypeLabel[tx.transaction_type] || tx.transaction_type}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{tx.tnx_id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold tabular-nums">UGX {Number(tx.amount).toLocaleString()}</p>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${tx.status === "approved" ? "badge-approved" : tx.status === "pending" ? "badge-pending" : "badge-rejected"}`}>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
};

export default MemberDashboard;
