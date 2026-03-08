import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoanApplication from "@/components/dashboard/member/LoanApplication";

const MemberLoanApplication = () => {
  const navigate = useNavigate();
  return (
    <DashboardLayout isAdmin={false}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Apply for Loan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Submit a new loan application</p>
      </div>
      <LoanApplication onApplicationSubmitted={() => navigate("/dashboard")} />
    </DashboardLayout>
  );
};

export default MemberLoanApplication;
