import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ReportsGeneration from "@/components/dashboard/admin/ReportsGeneration";
import FinancialIntegrityChecker from "@/components/dashboard/admin/FinancialIntegrityChecker";
import AIReportInsights from "@/components/dashboard/admin/AIReportInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, BarChart3, Sparkles } from "lucide-react";

const AdminReportsPage = () => {
  const [members, setMembers] = useState<{ id: string; full_name: string; accounts: any[] }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: accounts } = await supabase.from("accounts").select("id, account_number, user_id, account_type");
      const mainAccounts = (accounts || []).filter(a => a.account_type === "main");
      const userIds = [...new Set(mainAccounts.map(a => a.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const map = new Map<string, any[]>();
      mainAccounts.forEach(acc => {
        if (!map.has(acc.user_id)) map.set(acc.user_id, []);
        map.get(acc.user_id)!.push(acc);
      });
      setMembers((profiles || []).map(p => ({ id: p.id, full_name: p.full_name, accounts: map.get(p.id) || [] })));
    };
    load();
  }, []);

  return (
    <DashboardLayout isAdmin>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Reports & Integrity</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Generate financial reports, AI-enhanced bank statements, and verify balance integrity</p>
      </div>
      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="w-4 h-4" /> AI Reports
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Standard Reports
          </TabsTrigger>
          <TabsTrigger value="integrity" className="gap-2">
            <Bot className="w-4 h-4" /> AI Integrity Check
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai">
          <AIReportInsights members={members} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsGeneration />
        </TabsContent>
        <TabsContent value="integrity">
          <FinancialIntegrityChecker />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminReportsPage;
