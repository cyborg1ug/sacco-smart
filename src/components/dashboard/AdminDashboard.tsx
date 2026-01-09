import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, DollarSign, TrendingUp, FileText, Bell, Heart, BarChart3, CreditCard } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardHeader from "./DashboardHeader";
import MobileNavCard from "./MobileNavCard";
import MembersManagement from "./admin/MembersManagement";
import TransactionsManagement from "./admin/TransactionsManagement";
import LoansManagement from "./admin/LoansManagement";
import StatementsGeneration from "./admin/StatementsGeneration";
import ReportsGeneration from "./admin/ReportsGeneration";
import AlertsReminders from "./admin/AlertsReminders";
import WelfareManagement from "./admin/WelfareManagement";

const AdminDashboard = () => {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalSavings: 0,
    activeLoans: 0,
    pendingTransactions: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [accountsCountResult, accountsResult, loansResult, transactionsResult] = await Promise.all([
      supabase.from("accounts").select("id", { count: "exact" }),
      supabase.from("accounts").select("total_savings"),
      supabase.from("loans").select("id", { count: "exact" }).in("status", ["approved", "disbursed"]),
      supabase.from("transactions").select("id", { count: "exact" }).eq("status", "pending"),
    ]);

    const totalSavings = accountsResult.data?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;

    setStats({
      totalMembers: accountsCountResult.count || 0,
      totalSavings,
      activeLoans: loansResult.count || 0,
      pendingTransactions: transactionsResult.count || 0,
    });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="KINONI SACCO"
          subtitle="Admin Dashboard"
          isAdmin
        />

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground">Active accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold truncate">
                UGX {stats.totalSavings.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Combined</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Loans</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats.activeLoans}</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg sm:text-2xl font-bold">{stats.pendingTransactions}</div>
              <p className="text-xs text-muted-foreground">Awaiting</p>
            </CardContent>
          </Card>
        </div>

        {/* Mobile: Navigation Cards / Desktop: Tabs */}
        {isMobile ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Management</h2>
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
          <Tabs defaultValue="members" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="transactions">
                Transactions
                {stats.pendingTransactions > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs">
                    {stats.pendingTransactions}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="loans">Loans</TabsTrigger>
              <TabsTrigger value="welfare">Welfare</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
              <TabsTrigger value="statements">Statements</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <MembersManagement />
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <TransactionsManagement onUpdate={loadStats} />
            </TabsContent>

            <TabsContent value="loans" className="space-y-4">
              <LoansManagement onUpdate={loadStats} />
            </TabsContent>

            <TabsContent value="welfare" className="space-y-4">
              <WelfareManagement />
            </TabsContent>

            <TabsContent value="reminders" className="space-y-4">
              <AlertsReminders />
            </TabsContent>

            <TabsContent value="statements" className="space-y-4">
              <StatementsGeneration />
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <ReportsGeneration />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
