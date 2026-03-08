import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoansManagement from "@/components/dashboard/admin/LoansManagement";

const AdminLoansPage = () => {
  const [, setRefresh] = useState(0);
  return (
    <DashboardLayout isAdmin>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Loans</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage loan applications and disbursements</p>
      </div>
      <LoansManagement onUpdate={() => setRefresh(r => r + 1)} />
    </DashboardLayout>
  );
};

export default AdminLoansPage;
