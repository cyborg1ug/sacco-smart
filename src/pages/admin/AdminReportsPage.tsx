import DashboardLayout from "@/components/layout/DashboardLayout";
import ReportsGeneration from "@/components/dashboard/admin/ReportsGeneration";

const AdminReportsPage = () => (
  <DashboardLayout isAdmin>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Reports</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Generate comprehensive financial reports and analytics</p>
    </div>
    <ReportsGeneration />
  </DashboardLayout>
);

export default AdminReportsPage;
