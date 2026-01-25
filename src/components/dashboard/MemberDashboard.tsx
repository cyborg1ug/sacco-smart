import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  History,
  Users,
  ToggleLeft,
  ToggleRight,
  Eye,
  PlusCircle,
  CreditCard,
  Shield,
  PiggyBank,
  Bell,
  FileText,
  UsersRound,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import DashboardHeader from "./DashboardHeader";
import EnhancedMobileNavCard from "./EnhancedMobileNavCard";
import StatCard from "./StatCard";
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

interface AccountData {
  id: string;
  balance: number;
  total_savings: number;
  account_number: string;
}

interface SubAccountData {
  id: string;
  balance: number;
  total_savings: number;
  account_number: string;
  profile: {
    full_name: string;
  } | null;
}

interface JointTotals {
  balance: number;
  total_savings: number;
}

const MemberDashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [subAccounts, setSubAccounts] = useState<SubAccountData[]>([]);
  const [jointTotals, setJointTotals] = useState<JointTotals>({
    balance: 0,
    total_savings: 0,
  });
  const [activeLoans, setActiveLoans] = useState(0);
  const [pendingGuarantorRequests, setPendingGuarantorRequests] = useState(0);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [hasSubAccounts, setHasSubAccounts] = useState(false);
  const [showJointView, setShowJointView] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setUserName(profileData.full_name);
      }

      const { data: accountData } = await supabase
        .from("accounts")
        .select("id, balance, total_savings, account_number")
        .eq("user_id", user.id)
        .eq("account_type", "main")
        .maybeSingle();

      if (accountData) {
        setAccount(accountData);

        const { data: subAccountsData } = await supabase
          .from("accounts")
          .select("id, balance, total_savings, account_number")
          .eq("parent_account_id", accountData.id)
          .eq("account_type", "sub");

        if (subAccountsData && subAccountsData.length > 0) {
          setHasSubAccounts(true);

          const subAccountIds = subAccountsData.map((a) => a.id);
          const { data: subProfiles } = await supabase
            .from("sub_account_profiles")
            .select("account_id, full_name")
            .in("account_id", subAccountIds);

          const profilesMap = new Map(
            subProfiles?.map((p) => [p.account_id, p]) || []
          );

          const subAccountsWithProfiles = subAccountsData.map((sa) => ({
            ...sa,
            profile: profilesMap.get(sa.id) || null,
          }));

          setSubAccounts(subAccountsWithProfiles);

          const jointBalance =
            accountData.balance +
            subAccountsData.reduce((sum, sa) => sum + Number(sa.balance), 0);
          const jointSavings =
            accountData.total_savings +
            subAccountsData.reduce(
              (sum, sa) => sum + Number(sa.total_savings),
              0
            );
          setJointTotals({ balance: jointBalance, total_savings: jointSavings });
        } else {
          setHasSubAccounts(false);
          setSubAccounts([]);
          setJointTotals({
            balance: accountData.balance,
            total_savings: accountData.total_savings,
          });
        }

        const allAccountIds = [
          accountData.id,
          ...(subAccountsData?.map((sa) => sa.id) || []),
        ];

        const { count: loansCount } = await supabase
          .from("loans")
          .select("id", { count: "exact" })
          .in("account_id", allAccountIds)
          .in("status", ["approved", "disbursed"]);

        setActiveLoans(loansCount || 0);

        const { count: guarantorCount } = await (
          supabase
            .from("loans")
            .select("id", { count: "exact" }) as any
        )
          .in("guarantor_account_id", allAccountIds)
          .eq("guarantor_status", "pending");

        setPendingGuarantorRequests(guarantorCount || 0);
      }
    }
  };

  const mobileNavItems = [
    {
      to: "/member/overview",
      icon: Eye,
      title: "Overview",
      description: "View recent activity",
    },
    {
      to: "/member/record-transaction",
      icon: PlusCircle,
      title: "Record Transaction",
      description: "Deposit or withdraw",
    },
    {
      to: "/member/transactions",
      icon: History,
      title: "Transaction History",
      description: "View all transactions",
    },
    {
      to: "/member/loan-application",
      icon: CreditCard,
      title: "Apply for Loan",
      description: "Submit loan application",
    },
    {
      to: "/member/guarantor-requests",
      icon: Shield,
      title: "Guarantor Requests",
      description: "Approve loan guarantees",
      badge: pendingGuarantorRequests,
    },
    {
      to: "/member/savings",
      icon: PiggyBank,
      title: "Savings Tracker",
      description: "Track your savings",
    },
    {
      to: "/member/reminders",
      icon: Bell,
      title: "Reminders",
      description: "View notifications",
    },
    {
      to: "/member/statement",
      icon: FileText,
      title: "Account Statement",
      description: "Download statements",
    },
    ...(hasSubAccounts
      ? [
          {
            to: "/member/sub-accounts",
            icon: UsersRound,
            title: "Sub-Accounts",
            description: "Manage linked accounts",
          },
        ]
      : []),
    {
      to: "/member/profile",
      icon: User,
      title: "Profile Settings",
      description: "Update your information",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <DashboardHeader
          title="KINONI SACCO"
          subtitle={`Account: ${account?.account_number || ""}`}
          userName={userName}
          accountNumber={account?.account_number}
          showNotifications
          onProfileClick={() =>
            isMobile ? navigate("/member/profile") : setActiveTab("profile")
          }
        />

        {/* Joint View Toggle */}
        {hasSubAccounts && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 bg-card border rounded-xl px-4 py-2.5 w-fit shadow-sm"
          >
            <span
              className={`text-sm font-medium transition-colors ${
                !showJointView ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Main
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-7 hover:bg-transparent"
              onClick={() => setShowJointView(!showJointView)}
            >
              {showJointView ? (
                <ToggleRight className="h-7 w-7 text-primary" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-muted-foreground" />
              )}
            </Button>
            <span
              className={`text-sm font-medium transition-colors ${
                showJointView ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Joint
            </span>
          </motion.div>
        )}

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            title={showJointView ? "Joint Balance" : "Balance"}
            value={`UGX ${(
              showJointView
                ? jointTotals.balance
                : account?.balance || 0
            ).toLocaleString()}`}
            subtitle={showJointView ? "All accounts" : "Main account"}
            icon={Wallet}
            variant="primary"
            highlighted={showJointView}
          />

          <StatCard
            title={showJointView ? "Joint Savings" : "Savings"}
            value={`UGX ${(
              showJointView
                ? jointTotals.total_savings
                : account?.total_savings || 0
            ).toLocaleString()}`}
            subtitle={showJointView ? "Combined" : "Main savings"}
            icon={TrendingUp}
            variant="success"
            highlighted={showJointView}
          />

          <StatCard
            title="Active Loans"
            value={activeLoans}
            subtitle="In progress"
            icon={History}
            variant="info"
          />

          <StatCard
            title="Guarantor"
            value={pendingGuarantorRequests}
            subtitle="Pending requests"
            icon={Users}
            variant={pendingGuarantorRequests > 0 ? "warning" : "default"}
            highlighted={pendingGuarantorRequests > 0}
          />
        </motion.div>

        {/* Sub-Account Balances Summary - Hidden on mobile */}
        {hasSubAccounts && subAccounts.length > 0 && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            {subAccounts.map((subAcc) => (
              <Card
                key={subAcc.id}
                className="border-dashed hover:border-primary/30 transition-colors"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate">
                    {subAcc.profile?.full_name || subAcc.account_number}
                  </CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    UGX {subAcc.balance.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Savings: UGX {subAcc.total_savings.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Loan Completion Chart - Member View */}
        {account && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <LoanCompletionChart
              accountIds={[account.id, ...subAccounts.map((sa) => sa.id)]}
            />
          </motion.div>
        )}

        {/* Mobile: Navigation Cards / Desktop: Tabs */}
        {isMobile ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-muted/50 rounded-xl">
                <TabsTrigger
                  value="overview"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="record"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Record
                </TabsTrigger>
                <TabsTrigger
                  value="transactions"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <History className="h-4 w-4 mr-2" />
                  History
                </TabsTrigger>
                <TabsTrigger
                  value="loans"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Loan
                </TabsTrigger>
                <TabsTrigger
                  value="guarantor"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Guarantor
                  {pendingGuarantorRequests > 0 && (
                    <span className="ml-2 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                      {pendingGuarantorRequests}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="savings"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <PiggyBank className="h-4 w-4 mr-2" />
                  Savings
                </TabsTrigger>
                <TabsTrigger
                  value="reminders"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Reminders
                </TabsTrigger>
                <TabsTrigger
                  value="statement"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Statement
                </TabsTrigger>
                {hasSubAccounts && (
                  <TabsTrigger
                    value="subaccounts"
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <UsersRound className="h-4 w-4 mr-2" />
                    Sub-Accounts
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="profile"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-6">
                <AccountOverview />
              </TabsContent>

              <TabsContent value="record" className="space-y-4 mt-6">
                <RecordTransaction onTransactionRecorded={loadAccountData} />
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4 mt-6">
                <TransactionHistory />
              </TabsContent>

              <TabsContent value="loans" className="space-y-4 mt-6">
                <LoanApplication onApplicationSubmitted={loadAccountData} />
              </TabsContent>

              <TabsContent value="guarantor" className="space-y-4 mt-6">
                <GuarantorRequests />
              </TabsContent>

              <TabsContent value="savings" className="space-y-4 mt-6">
                <SavingsTracker />
              </TabsContent>

              <TabsContent value="reminders" className="space-y-4 mt-6">
                <MemberReminders />
              </TabsContent>

              <TabsContent value="statement" className="space-y-4 mt-6">
                <MemberStatement />
              </TabsContent>

              {hasSubAccounts && account && (
                <TabsContent value="subaccounts" className="space-y-4 mt-6">
                  <SubAccountsManager parentAccountId={account.id} />
                </TabsContent>
              )}

              <TabsContent value="profile" className="space-y-4 mt-6">
                <ProfileManagement />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MemberDashboard;