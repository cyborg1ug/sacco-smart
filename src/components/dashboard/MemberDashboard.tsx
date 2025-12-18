import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Wallet, TrendingUp, History, Users, User } from "lucide-react";
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

interface AccountData {
  id: string;
  balance: number;
  total_savings: number;
  account_number: string;
}

const MemberDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [activeLoans, setActiveLoans] = useState(0);
  const [pendingGuarantorRequests, setPendingGuarantorRequests] = useState(0);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [hasSubAccounts, setHasSubAccounts] = useState(false);

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

        // Count active loans
        const { count: loansCount } = await supabase
          .from("loans")
          .select("id", { count: "exact" })
          .eq("account_id", accountData.id)
          .in("status", ["approved", "disbursed"]);

        setActiveLoans(loansCount || 0);

        // Count pending guarantor requests
        const { count: guarantorCount } = await (supabase
          .from("loans")
          .select("id", { count: "exact" }) as any)
          .eq("guarantor_account_id", accountData.id)
          .eq("guarantor_status", "pending");

        setPendingGuarantorRequests(guarantorCount || 0);

        // Check if user has sub-accounts
        const { count: subAccountsCount } = await supabase
          .from("accounts")
          .select("id", { count: "exact" })
          .eq("parent_account_id", accountData.id)
          .eq("account_type", "sub");

        setHasSubAccounts((subAccountsCount || 0) > 0);
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

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {account?.balance.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">Available funds</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {account?.total_savings.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">Accumulated savings</p>
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
