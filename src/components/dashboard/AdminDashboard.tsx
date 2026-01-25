import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  DollarSign,
  TrendingUp,
  FileText,
  Bell,
  Heart,
  BarChart3,
  CreditCard,
  Clock,
  UserPlus,
  Plus,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardHeader from "./DashboardHeader";
import EnhancedMobileNavCard from "./EnhancedMobileNavCard";
import StatCard from "./StatCard";
import MembersManagement from "./admin/MembersManagement";
import TransactionsManagement from "./admin/TransactionsManagement";
import LoansManagement from "./admin/LoansManagement";
import StatementsGeneration from "./admin/StatementsGeneration";
import ReportsGeneration from "./admin/ReportsGeneration";
import AlertsReminders from "./admin/AlertsReminders";
import WelfareManagement from "./admin/WelfareManagement";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import LoanCompletionChart from "./charts/LoanCompletionChart";

const AdminDashboard = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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
    const [accountsCountResult, accountsResult, loansResult, transactionsResult] =
      await Promise.all([
        supabase.from("accounts").select("id", { count: "exact" }),
        supabase.from("accounts").select("total_savings"),
        supabase
          .from("loans")
          .select("id", { count: "exact" })
          .in("status", ["approved", "disbursed"]),
        supabase
          .from("transactions")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
      ]);

    const totalSavings =
      accountsResult.data?.reduce(
        (sum, acc) => sum + Number(acc.total_savings),
        0
      ) || 0;

    setStats({
      totalMembers: accountsCountResult.count || 0,
      totalSavings,
      activeLoans: loansResult.count || 0,
      pendingTransactions: transactionsResult.count || 0,
    });
  };

  const mobileNavItems = [
    {
      to: "/admin/members",
      icon: Users,
      title: "Members",
      description: "Manage member accounts",
    },
    {
      to: "/admin/transactions",
      icon: CreditCard,
      title: "Transactions",
      description: "View & approve transactions",
      badge: stats.pendingTransactions,
    },
    {
      to: "/admin/loans",
      icon: TrendingUp,
      title: "Loans",
      description: "Manage loan applications",
    },
    {
      to: "/admin/welfare",
      icon: Heart,
      title: "Welfare",
      description: "Manage welfare fees",
    },
    {
      to: "/admin/reminders",
      icon: Bell,
      title: "Reminders",
      description: "Send alerts & notifications",
    },
    {
      to: "/admin/statements",
      icon: FileText,
      title: "Statements",
      description: "Generate member statements",
    },
    {
      to: "/admin/reports",
      icon: BarChart3,
      title: "Reports",
      description: "Financial reports & charts",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <DashboardHeader title="KINONI SACCO" subtitle="Admin Dashboard" isAdmin />

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            title="Total Members"
            value={stats.totalMembers}
            subtitle="Active accounts"
            icon={Users}
            variant="primary"
          />

          <StatCard
            title="Total Savings"
            value={`UGX ${stats.totalSavings.toLocaleString()}`}
            subtitle="Combined savings"
            icon={DollarSign}
            variant="success"
          />

          <StatCard
            title="Active Loans"
            value={stats.activeLoans}
            subtitle="In progress"
            icon={TrendingUp}
            variant="info"
          />

          <StatCard
            title="Pending"
            value={stats.pendingTransactions}
            subtitle="Awaiting approval"
            icon={Clock}
            variant={stats.pendingTransactions > 0 ? "warning" : "default"}
            highlighted={stats.pendingTransactions > 0}
          />
        </motion.div>

        {/* Loan Completion Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <LoanCompletionChart isAdmin />
        </motion.div>
        {isMobile ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-foreground">Management</h2>
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
            <Tabs defaultValue="members" className="space-y-6">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-muted/50 rounded-xl">
                <TabsTrigger
                  value="members"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </TabsTrigger>
                <TabsTrigger
                  value="transactions"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Transactions
                  {stats.pendingTransactions > 0 && (
                    <span className="ml-2 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                      {stats.pendingTransactions}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="loans"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Loans
                </TabsTrigger>
                <TabsTrigger
                  value="welfare"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Welfare
                </TabsTrigger>
                <TabsTrigger
                  value="reminders"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Reminders
                </TabsTrigger>
                <TabsTrigger
                  value="statements"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Statements
                </TabsTrigger>
                <TabsTrigger
                  value="reports"
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-4 mt-6">
                <MembersManagement />
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4 mt-6">
                <TransactionsManagement onUpdate={loadStats} />
              </TabsContent>

              <TabsContent value="loans" className="space-y-4 mt-6">
                <LoansManagement onUpdate={loadStats} />
              </TabsContent>

              <TabsContent value="welfare" className="space-y-4 mt-6">
                <WelfareManagement />
              </TabsContent>

              <TabsContent value="reminders" className="space-y-4 mt-6">
                <AlertsReminders />
              </TabsContent>

              <TabsContent value="statements" className="space-y-4 mt-6">
                <StatementsGeneration />
              </TabsContent>

              <TabsContent value="reports" className="space-y-4 mt-6">
                <ReportsGeneration />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {/* Floating Action Button for Mobile */}
        {isMobile && (
          <FloatingActionButton
            actions={[
              {
                icon: UserPlus,
                label: "Add Member",
                onClick: () => navigate("/admin/members"),
              },
              {
                icon: Plus,
                label: "New Transaction",
                onClick: () => navigate("/admin/transactions"),
              },
              {
                icon: TrendingUp,
                label: "Manage Loans",
                onClick: () => navigate("/admin/loans"),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;