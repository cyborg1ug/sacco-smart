import { useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import LoansManagement from "@/components/dashboard/admin/LoansManagement";

const AdminLoansPage = () => {
  const [, setRefresh] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title="Loans Management"
          subtitle="Manage loan applications"
          isAdmin
          showBackButton
        />
        <LoansManagement onUpdate={() => setRefresh((r) => r + 1)} />
      </div>
    </div>
  );
};

export default AdminLoansPage;
