import DashboardLayout from "@/components/layout/DashboardLayout";
import TransactionHistory from "@/components/dashboard/member/TransactionHistory";

const MemberTransactions = () => (
  <DashboardLayout isAdmin={false}>
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">Transaction History</h2>
      <p className="text-sm text-muted-foreground mt-0.5">All your deposits, withdrawals and loan activity</p>
    </div>
    <TransactionHistory />
  </DashboardLayout>
);

export default MemberTransactions;
