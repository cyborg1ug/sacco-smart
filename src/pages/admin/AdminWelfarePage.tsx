import DashboardLayout from "@/components/layout/DashboardLayout";
import WelfareManagement from "@/components/dashboard/admin/WelfareManagement";

const AdminWelfarePage = () => (
  <DashboardLayout isAdmin>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Welfare</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Manage weekly welfare fee deductions</p>
    </div>
    <WelfareManagement />
  </DashboardLayout>
);

export default AdminWelfarePage;
