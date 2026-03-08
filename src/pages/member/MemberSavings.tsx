import DashboardLayout from "@/components/layout/DashboardLayout";
import SavingsTracker from "@/components/dashboard/member/SavingsTracker";

const MemberSavings = () => (
  <DashboardLayout isAdmin={false}>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Savings Tracker</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Monitor your savings progress over time</p>
    </div>
    <SavingsTracker />
  </DashboardLayout>
);

export default MemberSavings;
