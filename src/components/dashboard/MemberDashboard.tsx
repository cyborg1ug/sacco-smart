import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Wallet, TrendingUp, History, Users, ToggleLeft, ToggleRight,
  Eye, PlusCircle, CreditCard, Shield, PiggyBank, Bell, FileText, UsersRound, User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardHeader from "./DashboardHeader";
import MobileNavCard from "./MobileNavCard";
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
  const [jointTotals, setJointTotals] = useState<JointTotals>({ balance: 0, total_savings: 0 });
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
    const { data: { user } } = await supabase.auth.getUser();
    
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
          
          const subAccountIds = subAccountsData.map(a => a.id);
          const { data: subProfiles } = await supabase
            .from("sub_account_profiles")
            .select("account_id, full_name")
            .in("account_id", subAccountIds);

          const profilesMap = new Map(subProfiles?.map(p => [p.account_id, p]) || []);
          
          const subAccountsWithProfiles = subAccountsData.map(sa => ({
            ...sa,
            profile: profilesMap.get(sa.id) || null
          }));
          
          setSubAccounts(subAccountsWithProfiles);

          const jointBalance = accountData.balance + subAccountsData.reduce((sum, sa) => sum + Number(sa.balance), 0);
          const jointSavings = accountData.total_savings + subAccountsData.reduce((sum, sa) => sum + Number(sa.total_savings), 0);
          setJointTotals({ balance: jointBalance, total_savings: jointSavings });
        } else {
          setHasSubAccounts(false);
          setSubAccounts([]);
          setJointTotals({ balance: accountData.balance, total_savings: accountData.total_savings });
        }

        const allAccountIds = [accountData.id, ...(subAccountsData?.map(sa => sa.id) || [])];

        const { count: loansCount } = await supabase
          .from("loans")
          .select("id", { count: "exact" })
          .in("account_id", allAccountIds)
          .in("status", ["approved", "disbursed"]);

        setActiveLoans(loansCount || 0);

        const { count: guarantorCount } = await (supabase
          .from("loans")
          .select("id", { count: "exact" }) as any)
          .in("guarantor_account_id", allAccountIds)
          .eq("guarantor_status", "pending");

        setPendingGuarantorRequests(guarantorCount || 0);
      }
    }
  };

  const mobileNavItems = [
    { to: "/member/overview", icon: Eye, title: "Overview", description: "View recent activity" },
    { to: "/member/record-transaction", icon: PlusCircle, title: "Record Transaction", description: "Deposit or withdraw" },
    { to: "/member/transactions", icon: History, title: "Transaction History", description: "View all transactions" },
    { to: "/member/loan-application", icon: CreditCard, title: "Apply for Loan", description: "Submit loan application" },
    { to: "/member/guarantor-requests", icon: Shield, title: "Guarantor Requests", description: "Approve loan guarantees", badge: pendingGuarantorRequests },
    { to: "/member/savings", icon: PiggyBank, title: "Savings Tracker", description: "Track your savings" },
    { to: "/member/reminders", icon: Bell, title: "Reminders", description: "View notifications" },
    { to: "/member/statement", icon: FileText, title: "Account Statement", description: "Download statements" },
    ...(hasSubAccounts ? [{ to: "/member/sub-accounts", icon: UsersRound, title: "Sub-Accounts", description: "Manage linked accounts" }] : []),
    { to: "/member/profile", icon: User, title: "Profile Settings", description: "Update your information" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="KINONI SACCO"
          subtitle={`Account: ${account?.account_number || ""}`}
          userName={userName}
          accountNumber={account?.account_number}
          showNotifications
          onProfileClick={() => isMobile ? navigate("/member/profile") : setActiveTab("profile")}
        />

        {/* Joint View Toggle */}
        {hasSubAccounts && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 w-fit text-sm">
            <span className="text-muted-foreground">Main</span>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6"
              onClick={() => setShowJointView(!showJointView)}
            >
              {showJointView ? (
                <ToggleRight className="h-6 w-6 text-primary" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-muted-foreground" />
              )}
            </Button>
            <span className="text-muted-foreground">Joint</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className={showJointView ? "border-primary/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">
                {showJointView ? "Joint Balance" : "Balance"}
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold truncate">
                UGX {(showJointView ? jointTotals.balance : (account?.balance || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {showJointView ? "All accounts" : "Main account"}
              </p>
            </CardContent>
          </Card>

          <Card className={showJointView ? "border-primary/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">
                {showJointView ? "Joint Savings" : "Savings"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold truncate">
                UGX {(showJointView ? jointTotals.total_savings : (account?.total_savings || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {showJointView ? "Combined" : "Main savings"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Loans</CardTitle>
              <History className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold">{activeLoans}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Guarantor</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold">{pendingGuarantorRequests}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Sub-Account Balances Summary - Hidden on mobile */}
        {hasSubAccounts && subAccounts.length > 0 && !isMobile && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {subAccounts.map((subAcc) => (
              <Card key={subAcc.id} className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate">
                    {subAcc.profile?.full_name || subAcc.account_number}
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">UGX {subAcc.balance.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Savings: UGX {subAcc.total_savings.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Mobile: Navigation Cards / Desktop: Tabs */}
        {isMobile ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              {mobileNavItems.map((item) => (
                <MobileNavCard
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  badge={item.badge}
                />
              ))}
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="record">Record Transaction</TabsTrigger>
              <TabsTrigger value="transactions">History</TabsTrigger>
              <TabsTrigger value="loans">Apply for Loan</TabsTrigger>
              <TabsTrigger value="guarantor">
                Guarantor Requests
                {pendingGuarantorRequests > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs">
                    {pendingGuarantorRequests}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="savings">Savings</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
              <TabsTrigger value="statement">Statement</TabsTrigger>
              {hasSubAccounts && <TabsTrigger value="subaccounts">Sub-Accounts</TabsTrigger>}
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <AccountOverview />
            </TabsContent>

            <TabsContent value="record" className="space-y-4">
              <RecordTransaction onTransactionRecorded={loadAccountData} />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <TransactionHistory />
            </TabsContent>

            <TabsContent value="loans" className="space-y-4">
              <LoanApplication onApplicationSubmitted={loadAccountData} />
            </TabsContent>

            <TabsContent value="guarantor" className="space-y-4">
              <GuarantorRequests />
            </TabsContent>

            <TabsContent value="savings" className="space-y-4">
              <SavingsTracker />
            </TabsContent>

            <TabsContent value="reminders" className="space-y-4">
              <MemberReminders />
            </TabsContent>

            <TabsContent value="statement" className="space-y-4">
              <MemberStatement />
            </TabsContent>

            {hasSubAccounts && account && (
              <TabsContent value="subaccounts" className="space-y-4">
                <SubAccountsManager parentAccountId={account.id} />
              </TabsContent>
            )}

            <TabsContent value="profile" className="space-y-4">
              <ProfileManagement />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default MemberDashboard;
