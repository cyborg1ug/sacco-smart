import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MembersManagement from "@/components/dashboard/admin/MembersManagement";

const AdminMembersPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title="Members Management"
          subtitle="Manage SACCO members"
          isAdmin
          showBackButton
        />
        <MembersManagement />
      </div>
    </div>
  );
};

export default AdminMembersPage;
