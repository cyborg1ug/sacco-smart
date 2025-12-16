import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Users, DollarSign, TrendingUp, FileText, BarChart3, Bell, Heart } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import MembersManagement from "./admin/MembersManagement";
import TransactionsManagement from "./admin/TransactionsManagement";
import LoansManagement from "./admin/LoansManagement";
import StatementsGeneration from "./admin/StatementsGeneration";
import ReportsGeneration from "./admin/ReportsGeneration";
import AlertsReminders from "./admin/AlertsReminders";
import WelfareManagement from "./admin/WelfareManagement";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
    const [membersResult, accountsResult, loansResult, transactionsResult] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact" }),
      supabase.from("accounts").select("total_savings"),
      supabase.from("loans").select("id", { count: "exact" }).in("status", ["approved", "disbursed"]),
      supabase.from("transactions").select("id", { count: "exact" }).eq("status", "pending"),
    ]);

    const totalSavings = accountsResult.data?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;

    setStats({
      totalMembers: membersResult.count || 0,
      totalSavings,
      activeLoans: loansResult.count || 0,
      pendingTransactions: transactionsResult.count || 0,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">KINONI SACCO - Admin</h1>
            <p className="text-muted-foreground">Manage your SACCO operations</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground">Active member accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">UGX {stats.totalSavings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Combined member savings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeLoans}</div>
              <p className="text-xs text-muted-foreground">Loans in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTransactions}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
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
      </div>
    </div>
  );
};

export default AdminDashboard;