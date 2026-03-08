import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MembersManagement from "@/components/dashboard/admin/MembersManagement";

const AdminMembersPage = () => {
  return (
    <DashboardLayout isAdmin>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Members</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage SACCO member accounts</p>
      </div>
      <MembersManagement />
    </DashboardLayout>
  );
};

export default AdminMembersPage;
