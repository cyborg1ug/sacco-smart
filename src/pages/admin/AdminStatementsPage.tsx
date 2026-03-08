import DashboardLayout from "@/components/layout/DashboardLayout";
import StatementsGeneration from "@/components/dashboard/admin/StatementsGeneration";

const AdminStatementsPage = () => (
  <DashboardLayout isAdmin>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Statements</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Generate and download member account statements</p>
    </div>
    <StatementsGeneration />
  </DashboardLayout>
);

export default AdminStatementsPage;
