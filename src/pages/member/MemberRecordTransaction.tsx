import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RecordTransaction from "@/components/dashboard/member/RecordTransaction";

const MemberRecordTransaction = () => {
  const navigate = useNavigate();
  return (
    <DashboardLayout isAdmin={false}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Record Transaction</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Submit a deposit or loan repayment for approval</p>
      </div>
      <RecordTransaction onTransactionRecorded={() => navigate("/dashboard")} />
    </DashboardLayout>
  );
};

export default MemberRecordTransaction;
