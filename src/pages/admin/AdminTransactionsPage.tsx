import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TransactionsManagement from "@/components/dashboard/admin/TransactionsManagement";

const AdminTransactionsPage = () => {
  const [, setRefresh] = useState(0);
  return (
    <DashboardLayout isAdmin>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
        <p className="text-sm text-muted-foreground mt-0.5">View, approve and manage all transactions</p>
      </div>
      <TransactionsManagement onUpdate={() => setRefresh(r => r + 1)} />
    </DashboardLayout>
  );
};

export default AdminTransactionsPage;
