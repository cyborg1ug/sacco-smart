import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import LoanApplication from "@/components/dashboard/member/LoanApplication";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MemberLoanApplication = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [profileResult, accountResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("accounts").select("account_number").eq("user_id", user.id).eq("account_type", "main").maybeSingle(),
      ]);
      setUserName(profileResult.data?.full_name || "");
      setAccountNumber(accountResult.data?.account_number || "");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title="Apply for Loan"
          subtitle={`Account: ${accountNumber}`}
          userName={userName}
          accountNumber={accountNumber}
          showBackButton
          showNotifications
        />
        <LoanApplication onApplicationSubmitted={() => navigate("/dashboard")} />
      </div>
    </div>
  );
};

export default MemberLoanApplication;
