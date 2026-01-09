import DashboardHeader from "@/components/dashboard/DashboardHeader";
import AlertsReminders from "@/components/dashboard/admin/AlertsReminders";

const AdminRemindersPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title="Alerts & Reminders"
          subtitle="Manage member notifications"
          isAdmin
          showBackButton
        />
        <AlertsReminders />
      </div>
    </div>
  );
};

export default AdminRemindersPage;
