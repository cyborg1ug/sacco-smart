import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SubAccountsManager from "@/components/dashboard/member/SubAccountsManager";
import { Loader2 } from "lucide-react";

const MemberSubAccounts = () => {
  const [userName, setUserName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountId, setAccountId] = useState("");
  const [pendingGuarantor, setPendingGuarantor] = useState(0);
  const [hasSubAccounts, setHasSubAccounts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [profileResult, accountResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("accounts").select("id, account_number").eq("user_id", user.id).eq("account_type", "main").maybeSingle(),
      ]);
      setUserName(profileResult.data?.full_name || "");
      setAccountNumber(accountResult.data?.account_number || "");
      setAccountId(accountResult.data?.id || "");

      if (accountResult.data?.id) {
        const [subAccountsResult, guarantorResult] = await Promise.all([
          supabase.from("accounts").select("id").eq("parent_account_id", accountResult.data.id),
          supabase.from("loans").select("id").eq("guarantor_account_id", accountResult.data.id).eq("guarantor_status", "pending"),
        ]);
        setHasSubAccounts((subAccountsResult.data?.length ?? 0) > 0);
        setPendingGuarantor(guarantorResult.data?.length ?? 0);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout
      isAdmin={false}
      userName={userName}
      accountNumber={accountNumber}
      pendingGuarantor={pendingGuarantor}
      hasSubAccounts={hasSubAccounts}
    >
      {accountId && <SubAccountsManager parentAccountId={accountId} />}
    </DashboardLayout>
  );
};

export default MemberSubAccounts;
