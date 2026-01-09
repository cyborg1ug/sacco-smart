import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatementsGeneration from "@/components/dashboard/admin/StatementsGeneration";

const AdminStatementsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title="Statements"
          subtitle="Generate member statements"
          isAdmin
          showBackButton
        />
        <StatementsGeneration />
      </div>
    </div>
  );
};

export default AdminStatementsPage;
