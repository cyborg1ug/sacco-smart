import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Wallet, TrendingUp, History, Users, User, ToggleLeft, ToggleRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import NotificationsPopover from "./member/NotificationsPopover";

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
  const { toast } = useToast();
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
      // Get profile name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (profileData) {
        setUserName(profileData.full_name);
      }

      // Get main account (not sub-accounts)
      const { data: accountData } = await supabase
        .from("accounts")
        .select("id, balance, total_savings, account_number")
        .eq("user_id", user.id)
        .eq("account_type", "main")
        .maybeSingle();

      if (accountData) {
        setAccount(accountData);

        // Get sub-accounts and their profiles
        const { data: subAccountsData } = await supabase
          .from("accounts")
          .select("id, balance, total_savings, account_number")
          .eq("parent_account_id", accountData.id)
          .eq("account_type", "sub");

        if (subAccountsData && subAccountsData.length > 0) {
          setHasSubAccounts(true);
          
          // Get sub-account profiles
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

          // Calculate joint totals
          const jointBalance = accountData.balance + subAccountsData.reduce((sum, sa) => sum + Number(sa.balance), 0);
          const jointSavings = accountData.total_savings + subAccountsData.reduce((sum, sa) => sum + Number(sa.total_savings), 0);
          setJointTotals({ balance: jointBalance, total_savings: jointSavings });
        } else {
          setHasSubAccounts(false);
          setSubAccounts([]);
          setJointTotals({ balance: accountData.balance, total_savings: accountData.total_savings });
        }

        // Get all account IDs (main + sub) for counting loans
        const allAccountIds = [accountData.id, ...(subAccountsData?.map(sa => sa.id) || [])];

        // Count active loans from main account AND sub-accounts
        const { count: loansCount } = await supabase
          .from("loans")
          .select("id", { count: "exact" })
          .in("account_id", allAccountIds)
          .in("status", ["approved", "disbursed"]);

        setActiveLoans(loansCount || 0);

        // Count pending guarantor requests for main account AND sub-accounts
        const { count: guarantorCount } = await (supabase
          .from("loans")
          .select("id", { count: "exact" }) as any)
          .in("guarantor_account_id", allAccountIds)
          .eq("guarantor_status", "pending");

        setPendingGuarantorRequests(guarantorCount || 0);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate("/auth");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">KINONI SACCO</h1>
            <p className="text-muted-foreground">Account: {account?.account_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsPopover />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(userName || "U")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{userName}</p>
                    <p className="text-sm text-muted-foreground">{account?.account_number}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Joint View Toggle */}
        {hasSubAccounts && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2 w-fit">
            <span className="text-sm text-muted-foreground">Main Account</span>
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
            <span className="text-sm text-muted-foreground">Joint View</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className={showJointView ? "border-primary/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {showJointView ? "Joint Balance" : "Current Balance"}
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {(showJointView ? jointTotals.balance : (account?.balance || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {showJointView ? "Main + Sub-accounts" : "Main account funds"}
              </p>
            </CardContent>
          </Card>

          <Card className={showJointView ? "border-primary/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {showJointView ? "Joint Savings" : "Total Savings"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {(showJointView ? jointTotals.total_savings : (account?.total_savings || 0)).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {showJointView ? "Combined savings" : "Main account savings"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeLoans}</div>
              <p className="text-xs text-muted-foreground">Loans in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guarantor Requests</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingGuarantorRequests}</div>
              <p className="text-xs text-muted-foreground">Pending approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Sub-Account Balances Summary */}
        {hasSubAccounts && subAccounts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {subAccounts.map((subAcc) => (
              <Card key={subAcc.id} className="border-dashed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium truncate">
                    {subAcc.profile?.full_name || subAcc.account_number}
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
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
      </div>
    </div>
  );
};

export default MemberDashboard;
