import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ReportsGeneration from "@/components/dashboard/admin/ReportsGeneration";

const AdminReportsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title="Reports"
          subtitle="Generate financial reports"
          isAdmin
          showBackButton
        />
        <ReportsGeneration />
      </div>
    </div>
  );
};

export default AdminReportsPage;
