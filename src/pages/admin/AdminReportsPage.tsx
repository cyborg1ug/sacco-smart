import DashboardLayout from "@/components/layout/DashboardLayout";
import ReportsGeneration from "@/components/dashboard/admin/ReportsGeneration";
import FinancialIntegrityChecker from "@/components/dashboard/admin/FinancialIntegrityChecker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, BarChart3 } from "lucide-react";

const AdminReportsPage = () => (
  <DashboardLayout isAdmin>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Reports & Integrity</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Generate financial reports and verify balance integrity with AI</p>
    </div>
    <Tabs defaultValue="reports" className="space-y-4">
      <TabsList className="bg-muted/50">
        <TabsTrigger value="reports" className="gap-2">
          <BarChart3 className="w-4 h-4" /> Reports
        </TabsTrigger>
        <TabsTrigger value="integrity" className="gap-2">
          <Bot className="w-4 h-4" /> AI Integrity Check
        </TabsTrigger>
      </TabsList>
      <TabsContent value="reports">
        <ReportsGeneration />
      </TabsContent>
      <TabsContent value="integrity">
        <FinancialIntegrityChecker />
      </TabsContent>
    </Tabs>
  </DashboardLayout>
);

export default AdminReportsPage;
