import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, User, Phone, Mail, MapPin, Briefcase, CreditCard, Wallet, TrendingUp, FileText, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface MemberDetails {
  id: string;
  account_number: string;
  balance: number;
  total_savings: number;
  account_type: string;
  created_at: string;
  user_id: string;
  parent_account_id: string | null;
  profile: {
    full_name: string;
    email: string;
    phone_number: string | null;
    national_id: string | null;
    occupation: string | null;
    address: string | null;
  };
}

interface LoanSummary {
  total_loans: number;
  active_loans: number;
  total_borrowed: number;
  total_outstanding: number;
}

interface TransactionSummary {
  total_deposits: number;
  total_withdrawals: number;
  total_loan_repayments: number;
}

const AdminMemberDetails = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [loanSummary, setLoanSummary] = useState<LoanSummary>({ total_loans: 0, active_loans: 0, total_borrowed: 0, total_outstanding: 0 });
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary>({ total_deposits: 0, total_withdrawals: 0, total_loan_repayments: 0 });
  const [subAccounts, setSubAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      loadMemberDetails();
    }
  }, [accountId]);

  const loadMemberDetails = async () => {
    if (!accountId) return;

    // Load account details
    const { data: accountData } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (!accountData) {
      setLoading(false);
      return;
    }

    // Load profile based on account type
    let profile;
    if (accountData.account_type === 'sub') {
      const { data: subProfile } = await supabase
        .from("sub_account_profiles")
        .select("*")
        .eq("account_id", accountId)
        .single();
      profile = {
        full_name: subProfile?.full_name || "Unknown",
        email: "",
        phone_number: subProfile?.phone_number,
        national_id: subProfile?.national_id,
        occupation: subProfile?.occupation,
        address: subProfile?.address
      };
    } else {
      const { data: mainProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", accountData.user_id)
        .single();
      profile = mainProfile || { full_name: "Unknown", email: "", phone_number: null, national_id: null, occupation: null, address: null };
    }

    setMember({
      ...accountData,
      profile
    });

    // Load sub-accounts if main account
    if (accountData.account_type === 'main') {
      const { data: subAccountsData } = await supabase
        .from("accounts")
        .select("*")
        .eq("parent_account_id", accountId);

      if (subAccountsData && subAccountsData.length > 0) {
        const subAccountIds = subAccountsData.map(a => a.id);
        const { data: subProfiles } = await supabase
          .from("sub_account_profiles")
          .select("*")
          .in("account_id", subAccountIds);

        const subProfilesMap = new Map(subProfiles?.map(p => [p.account_id, p]) || []);
        setSubAccounts(subAccountsData.map(a => ({
          ...a,
          profile: subProfilesMap.get(a.id) || { full_name: "Unknown" }
        })));
      }
    }

    // Load loan summary
    const { data: loansData } = await supabase
      .from("loans")
      .select("amount, outstanding_balance, status")
      .eq("account_id", accountId);

    if (loansData) {
      const activeLoans = loansData.filter(l => l.status === 'active' || l.status === 'disbursed');
      setLoanSummary({
        total_loans: loansData.length,
        active_loans: activeLoans.length,
        total_borrowed: loansData.reduce((sum, l) => sum + l.amount, 0),
        total_outstanding: loansData.reduce((sum, l) => sum + (l.outstanding_balance || 0), 0)
      });
    }

    // Load transaction summary
    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("transaction_type, amount, status")
      .eq("account_id", accountId)
      .eq("status", "approved");

    if (transactionsData) {
      setTransactionSummary({
        total_deposits: transactionsData.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
        total_withdrawals: transactionsData.filter(t => t.transaction_type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0),
        total_loan_repayments: transactionsData.filter(t => t.transaction_type === 'loan_repayment').reduce((sum, t) => sum + t.amount, 0)
      });
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

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto p-4 sm:p-6">
          <DashboardHeader title="Member Not Found" subtitle="The requested member could not be found" isAdmin showBackButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <DashboardHeader
          title={member.profile.full_name}
          subtitle={`Account: ${member.account_number}`}
          isAdmin
          showBackButton
        />

        {/* Personal Information */}
        <Card className="overflow-hidden border-l-4 border-l-primary">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="font-medium">{member.profile.full_name}</p>
                </div>
              </div>
              {member.profile.email && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{member.profile.email}</p>
                  </div>
                </div>
              )}
              {member.profile.phone_number && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{member.profile.phone_number}</p>
                  </div>
                </div>
              )}
              {member.profile.national_id && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">National ID</p>
                    <p className="font-medium">{member.profile.national_id}</p>
                  </div>
                </div>
              )}
              {member.profile.occupation && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Occupation</p>
                    <p className="font-medium">{member.profile.occupation}</p>
                  </div>
                </div>
              )}
              {member.profile.address && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">{member.profile.address}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-success" />
                <span className="text-xs text-muted-foreground">Balance</span>
              </div>
              <p className="text-xl font-bold mt-2">UGX {member.balance.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">Total Savings</span>
              </div>
              <p className="text-xl font-bold mt-2">UGX {member.total_savings.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-warning" />
                <span className="text-xs text-muted-foreground">Active Loans</span>
              </div>
              <p className="text-xl font-bold mt-2">{loanSummary.active_loans}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-destructive" />
                <span className="text-xs text-muted-foreground">Outstanding</span>
              </div>
              <p className="text-xl font-bold mt-2">UGX {loanSummary.total_outstanding.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Summary</CardTitle>
            <CardDescription>Overview of all approved transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <p className="text-sm text-muted-foreground">Total Deposits</p>
                <p className="text-2xl font-bold text-success">UGX {transactionSummary.total_deposits.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-muted-foreground">Total Withdrawals</p>
                <p className="text-2xl font-bold text-destructive">UGX {transactionSummary.total_withdrawals.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">Loan Repayments</p>
                <p className="text-2xl font-bold text-primary">UGX {transactionSummary.total_loan_repayments.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate(`/admin/transactions/${accountId}`)}>
            <FileText className="mr-2 h-4 w-4" />
            View Transactions
          </Button>
        </div>

        {/* Sub-Accounts (if main account) */}
        {subAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sub-Accounts</CardTitle>
              <CardDescription>Linked sub-accounts under this member</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subAccounts.map((sub) => (
                  <Card key={sub.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/members/${sub.id}`)}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{sub.profile?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{sub.account_number}</p>
                        </div>
                        <Badge variant="secondary">Sub</Badge>
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-muted-foreground">Balance:</span>
                        <span className="font-medium">UGX {sub.balance.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Account Type</p>
                <Badge variant={member.account_type === 'main' ? 'default' : 'secondary'} className="mt-1">
                  {member.account_type}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Member Since</p>
                <p className="font-medium mt-1">{format(new Date(member.created_at), "MMM dd, yyyy")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMemberDetails;
