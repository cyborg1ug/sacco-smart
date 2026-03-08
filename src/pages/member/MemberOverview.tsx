import DashboardLayout from "@/components/layout/DashboardLayout";
import AccountOverview from "@/components/dashboard/member/AccountOverview";

const MemberOverview = () => (
  <DashboardLayout isAdmin={false}>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Account Overview</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Your recent activity and account summary</p>
    </div>
    <AccountOverview />
  </DashboardLayout>
);

export default MemberOverview;
