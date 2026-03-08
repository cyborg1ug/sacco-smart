import DashboardLayout from "@/components/layout/DashboardLayout";
import AlertsReminders from "@/components/dashboard/admin/AlertsReminders";

const AdminRemindersPage = () => (
  <DashboardLayout isAdmin>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Reminders</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Send alerts and manage member notifications</p>
    </div>
    <AlertsReminders />
  </DashboardLayout>
);

export default AdminRemindersPage;
