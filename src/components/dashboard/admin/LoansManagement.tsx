import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Send, Loader2, Users, UserPlus, CheckCircle, Edit, Clock, CheckCircle2, TrendingUp, Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MobileCardList, MobileCard } from "@/components/ui/MobileCardList";

interface Loan {
  id: string;
  amount: number;
  interest_rate: number;
  total_amount: number;
  outstanding_balance: number;
  status: string;
  created_at: string;
  disbursed_at: string | null;
  guarantor_account_id: string | null;
  guarantor_status: string | null;
  max_loan_amount: number | null;
  repayment_months: number;
  account: {
    id: string;
    account_number: string;
    user: {
      full_name: string;
    };
  };
  guarantor_account?: {
    account_number: string;
    user: {
      full_name: string;
    };
  } | null;
}

interface LoansManagementProps {
  onUpdate: () => void;
}

const LoansManagement = ({ onUpdate }: LoansManagementProps) => {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [guarantorDialogOpen, setGuarantorDialogOpen] = useState(false);
  const [editLoanDialogOpen, setEditLoanDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedGuarantor, setSelectedGuarantor] = useState("");
  const [guarantorCandidates, setGuarantorCandidates] = useState<any[]>([]);
  const [loadingGuarantors, setLoadingGuarantors] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit form state
  const [editRepaymentMonths, setEditRepaymentMonths] = useState<number>(1);
  const [editDisbursedAt, setEditDisbursedAt] = useState<string>("");
  const [editGuarantor, setEditGuarantor] = useState<string>("");

  // Filter loans by status and search
  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && loan.status !== "pending") return false;
        if (statusFilter === "approved" && loan.status !== "approved") return false;
        if (statusFilter === "active" && !["disbursed", "active"].includes(loan.status)) return false;
        if (statusFilter === "completed" && loan.status !== "completed" && loan.status !== "fully_paid") return false;
      }
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          loan.account.user.full_name.toLowerCase().includes(query) ||
          loan.account.account_number.toLowerCase().includes(query) ||
          loan.guarantor_account?.user?.full_name?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [loans, statusFilter, searchQuery]);

  // Setup real-time subscription for loans and transactions
  useEffect(() => {
    loadLoans();
    
    // Subscribe to real-time loan updates
    const loansChannel = supabase
      .channel('loans-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          loadLoans();
        }
      )
      .subscribe();

    // Subscribe to real-time transaction updates (for loan repayments)
    const transactionsChannel = supabase
      .channel('transactions-realtime-loans')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload: any) => {
          // Reload loans when a loan-related transaction changes
          if (payload.new?.transaction_type === 'loan_repayment' || 
              payload.new?.transaction_type === 'loan_disbursement' ||
              payload.old?.transaction_type === 'loan_repayment' ||
              payload.old?.transaction_type === 'loan_disbursement') {
            loadLoans();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(loansChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, []);

  const loadLoans = async () => {
    // Fetch all loans
    const { data: loansData } = await supabase
      .from("loans")
      .select("*")
      .order("created_at", { ascending: false });

    if (!loansData) {
      setLoading(false);
      return;
    }

    // Get unique account IDs (both loan accounts and guarantor accounts)
    const accountIds = [...new Set([
      ...loansData.map(l => l.account_id),
      ...loansData.filter(l => l.guarantor_account_id).map(l => l.guarantor_account_id as string)
    ])];

    // Fetch accounts
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type")
      .in("id", accountIds);

    if (!accountsData) {
      setLoading(false);
      return;
    }

    // Separate main accounts and sub-accounts
    const mainAccountUserIds = [...new Set(accountsData.filter(a => a.account_type === 'main').map(a => a.user_id))];
    const subAccountIds = accountsData.filter(a => a.account_type === 'sub').map(a => a.id);

    // Fetch profiles for main accounts
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", mainAccountUserIds);

    // Fetch sub_account_profiles for sub-accounts
    const { data: subAccountProfilesData } = await supabase
      .from("sub_account_profiles")
      .select("account_id, full_name")
      .in("account_id", subAccountIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
    const subProfilesMap = new Map(subAccountProfilesData?.map(p => [p.account_id, p.full_name]) || []);

    // Build accounts map with proper names
    const accountsMap = new Map(accountsData.map(a => {
      let fullName = "Unknown";
      if (a.account_type === 'sub') {
        fullName = subProfilesMap.get(a.id) || "Unknown";
      } else {
        fullName = profilesMap.get(a.user_id) || "Unknown";
      }
      return [a.id, {
        id: a.id,
        account_number: a.account_number,
        user: { full_name: fullName }
      }];
    }));

    // Map loans with account info
    const loansWithAccounts = loansData.map(loan => ({
      ...loan,
      account: accountsMap.get(loan.account_id) || { id: loan.account_id, account_number: "Unknown", user: { full_name: "Unknown" } },
      guarantor_account: loan.guarantor_account_id ? accountsMap.get(loan.guarantor_account_id) : null
    }));

    setLoans(loansWithAccounts as any);
    setLoading(false);
  };

  const loadGuarantorCandidates = async (loanAccountId: string) => {
    setLoadingGuarantors(true);
    // Get all accounts except the loan applicant's account
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type, total_savings");

    if (!accountsData) {
      setLoadingGuarantors(false);
      return;
    }

    // Get all accounts that are currently guarantors on active/outstanding loans
    const { data: activeGuarantorLoans } = await supabase
      .from("loans")
      .select("guarantor_account_id")
      .in("status", ["pending", "approved", "disbursed", "active"])
      .gt("outstanding_balance", 0)
      .not("guarantor_account_id", "is", null);

    const alreadyGuaranteeing = new Set(
      activeGuarantorLoans?.map(l => l.guarantor_account_id).filter(Boolean) || []
    );

    // Get loan applicant's savings
    const loanAccount = accountsData.find(a => a.id === loanAccountId);
    const minSavings = loanAccount?.total_savings || 0;

    // Filter candidates:
    // 1. Must have savings >= applicant's savings
    // 2. Exclude the loan applicant
    // 3. Exclude accounts already guaranteeing outstanding loans
    const eligibleAccounts = accountsData.filter(a => 
      a.id !== loanAccountId && 
      a.total_savings >= minSavings &&
      !alreadyGuaranteeing.has(a.id)
    );

    // Get profiles for main accounts
    const mainAccountUserIds = [...new Set(eligibleAccounts.filter(a => a.account_type === 'main').map(a => a.user_id))];
    const subAccountIds = eligibleAccounts.filter(a => a.account_type === 'sub').map(a => a.id);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", mainAccountUserIds);

    const { data: subAccountProfilesData } = await supabase
      .from("sub_account_profiles")
      .select("account_id, full_name")
      .in("account_id", subAccountIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
    const subProfilesMap = new Map(subAccountProfilesData?.map(p => [p.account_id, p.full_name]) || []);

    const candidates = eligibleAccounts.map(a => ({
      id: a.id,
      account_number: a.account_number,
      full_name: a.account_type === 'sub' ? subProfilesMap.get(a.id) : profilesMap.get(a.user_id),
      total_savings: a.total_savings,
    }));

    setGuarantorCandidates(candidates);
    setLoadingGuarantors(false);
  };

  const openGuarantorDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setSelectedGuarantor(loan.guarantor_account_id || "");
    loadGuarantorCandidates(loan.account.id);
    setGuarantorDialogOpen(true);
  };

  const handleSetGuarantor = async () => {
    if (!selectedLoan || !selectedGuarantor) return;

    const { error } = await supabase
      .from("loans")
      .update({
        guarantor_account_id: selectedGuarantor,
        guarantor_status: "pending",
      })
      .eq("id", selectedLoan.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Guarantor assigned successfully",
      });
      setGuarantorDialogOpen(false);
      loadLoans();
      onUpdate();
    }
  };

  const handleApproveGuarantor = async (loanId: string) => {
    const { error } = await supabase
      .from("loans")
      .update({
        guarantor_status: "approved",
      })
      .eq("id", loanId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Guarantor approved by admin",
      });
      loadLoans();
      onUpdate();
    }
  };

  const sendLoanNotification = async (loan: Loan, newStatus: string) => {
    try {
      // Get account user_id first
      const { data: accountData } = await supabase
        .from("accounts")
        .select("user_id")
        .eq("id", loan.account.id)
        .single();

      if (accountData) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", accountData.user_id)
          .single();

        await supabase.functions.invoke("loan-status-notification", {
          body: {
            loanId: loan.id,
            newStatus,
            memberName: loan.account.user?.full_name || "Member",
            memberEmail: profile?.email,
            loanAmount: loan.amount,
            outstandingBalance: loan.outstanding_balance,
            accountId: loan.account.id,
          },
        });
      }
    } catch (error) {
      console.error("Error sending loan notification:", error);
    }
  };

  const handleApprove = async (loan: Loan) => {
    // Check if guarantor approval is required and pending
    if (loan.guarantor_account_id && loan.guarantor_status !== "approved") {
      toast({
        title: "Cannot Approve Yet",
        description: "The guarantor must approve this loan request first",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Approved loans become active immediately
    const { error } = await supabase
      .from("loans")
      .update({
        status: "active",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", loan.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Loan approved and is now active",
      });
      // Send notification
      sendLoanNotification({ ...loan, outstanding_balance: loan.total_amount }, "approved");
      loadLoans();
      onUpdate();
    }
  };

  const handleReject = async (loanId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const loan = loans.find(l => l.id === loanId);

    const { error } = await supabase
      .from("loans")
      .update({
        status: "rejected",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Loan rejected",
      });
      if (loan) sendLoanNotification(loan, "rejected");
      loadLoans();
      onUpdate();
    }
  };

  const handleDisburse = async (loan: Loan) => {
    const { id: loanId, account, amount, total_amount } = loan;
    const accountId = account.id;
    
    // Update loan status to disbursed (active until fully repaid)
    const { error: loanError } = await supabase
      .from("loans")
      .update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    if (loanError) {
      toast({
        title: "Error",
        description: loanError.message,
        variant: "destructive",
      });
      return;
    }

    // Create transaction for loan disbursement
    const { data: accountData } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", accountId)
      .single();

    if (!accountData) return;

    const newBalance = accountData.balance + amount;

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        account_id: accountId,
        transaction_type: "loan_disbursement",
        amount,
        balance_after: newBalance,
        description: `Loan disbursement for loan ${loanId}`,
        status: "pending",
        loan_id: loanId,
      } as any);

    if (transactionError) {
      toast({
        title: "Error",
        description: transactionError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Loan disbursed - awaiting transaction approval",
      });
      // Send notification
      sendLoanNotification({ ...loan, outstanding_balance: total_amount }, "disbursed");
      loadLoans();
      onUpdate();
    }
  };

  const openEditLoanDialog = async (loan: Loan) => {
    setSelectedLoan(loan);
    setEditRepaymentMonths(loan.repayment_months || 1);
    setEditDisbursedAt(loan.disbursed_at ? format(new Date(loan.disbursed_at), "yyyy-MM-dd") : "");
    setEditGuarantor(loan.guarantor_account_id || "");
    await loadGuarantorCandidates(loan.account.id);
    setEditLoanDialogOpen(true);
  };

  const handleUpdateLoanDetails = async () => {
    if (!selectedLoan) return;

    // First fetch actual repaid amount from transactions
    const { data: repaymentData } = await supabase
      .from("transactions")
      .select("amount")
      .eq("loan_id", selectedLoan.id)
      .eq("transaction_type", "loan_repayment")
      .eq("status", "approved");

    const totalRepaid = repaymentData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Interest is 2% per month × repayment months
    const monthlyInterest = selectedLoan.amount * (selectedLoan.interest_rate / 100);
    const totalInterest = monthlyInterest * editRepaymentMonths;
    const newTotalAmount = selectedLoan.amount + totalInterest;
    
    // Calculate new outstanding based on actual repayments
    const newOutstanding = Math.max(0, newTotalAmount - totalRepaid);
    
    // Determine correct status based on outstanding balance
    let newStatus = selectedLoan.status;
    if (newOutstanding <= 0) {
      newStatus = "fully_paid";
    } else if (selectedLoan.disbursed_at || editDisbursedAt) {
      newStatus = "disbursed";
    }

    const updateData: any = {
      repayment_months: editRepaymentMonths,
      total_amount: newTotalAmount,
      outstanding_balance: newOutstanding,
      status: newStatus,
    };

    // Update disbursed date if provided
    if (editDisbursedAt) {
      updateData.disbursed_at = new Date(editDisbursedAt).toISOString();
    }

    // Update guarantor if changed (handle "none" as null)
    const normalizedGuarantor = editGuarantor === "none" || editGuarantor === "" ? null : editGuarantor;
    if (normalizedGuarantor && normalizedGuarantor !== selectedLoan.guarantor_account_id) {
      updateData.guarantor_account_id = normalizedGuarantor;
      updateData.guarantor_status = "approved"; // Admin-assigned guarantors are auto-approved
    } else if (!normalizedGuarantor && selectedLoan.guarantor_account_id) {
      updateData.guarantor_account_id = null;
      updateData.guarantor_status = null;
    }

    const { error } = await supabase
      .from("loans")
      .update(updateData)
      .eq("id", selectedLoan.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Loan details updated successfully",
      });
      setEditLoanDialogOpen(false);
      loadLoans();
      onUpdate();
    }
  };

  const getGuarantorStatusBadge = (status: string | null) => {
    if (!status || status === "none") return null;
    return (
      <Badge variant={
        status === "approved" ? "default" :
        status === "pending" ? "outline" : "destructive"
      } className="text-[9px] sm:text-[10px]">
        {status}
      </Badge>
    );
  };

  const getLoanStatusBadge = (loan: Loan) => {
    // Treat disbursed loans as active until fully repaid
    const displayStatus = loan.status === "disbursed" ? "active" : loan.status;
    const isFullyRepaid = loan.outstanding_balance <= 0;
    
    // If loan is active/disbursed but fully repaid, show as completed
    if ((loan.status === "active" || loan.status === "disbursed") && isFullyRepaid) {
      return { label: "completed", variant: "default" as const };
    }
    
    switch (displayStatus) {
      case "active":
        return { label: "active", variant: "default" as const };
      case "completed":
        return { label: "completed", variant: "default" as const };
      case "approved":
        return { label: "approved", variant: "secondary" as const };
      case "pending":
        return { label: "pending", variant: "outline" as const };
      default:
        return { label: displayStatus, variant: "destructive" as const };
    }
  };

  const renderLoanActions = (loan: Loan) => {
    if (loan.status === "pending") {
      return (
        <div className="flex gap-1 flex-wrap">
          {/* Admin guarantor management */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openGuarantorDialog(loan)}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Set/Change Guarantor</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Admin approve guarantor */}
          {loan.guarantor_account_id && loan.guarantor_status === "pending" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApproveGuarantor(loan.id)}
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approve Guarantor (Admin)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleApprove(loan)}
                  disabled={loan.guarantor_account_id !== null && loan.guarantor_status !== "approved"}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {loan.guarantor_account_id && loan.guarantor_status !== "approved" 
                  ? "Waiting for guarantor approval" 
                  : "Approve loan"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleReject(loan.id)}
            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
          </Button>
        </div>
      );
    }
    
    // For active/disbursed/approved/fully_paid loans, show edit and disburse buttons
    if (["active", "disbursed", "approved", "fully_paid", "completed"].includes(loan.status)) {
      return (
        <div className="flex gap-1">
          {/* Disburse button for approved/active loans without disbursement yet */}
          {(loan.status === "approved" || (loan.status === "active" && !loan.disbursed_at)) && (
            <Button
              size="sm"
              onClick={() => handleDisburse(loan)}
              className="h-7 sm:h-8 text-[10px] sm:text-xs bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70"
            >
              <Send className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Disburse
            </Button>
          )}
          
          {/* Edit button for all active/disbursed/completed loans */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditLoanDialog(loan)}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Loan Details</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    
    return null;
  };

  const calculateMonthlyPayment = (loan: Loan) => {
    // Interest is 2% per month × repayment months
    const monthlyInterest = loan.amount * (loan.interest_rate / 100);
    const totalInterest = monthlyInterest * (loan.repayment_months || 1);
    const totalWithInterest = loan.amount + totalInterest;
    const monthlyPayment = totalWithInterest / (loan.repayment_months || 1);
    return { monthlyPayment, totalInterest, totalWithInterest };
  };

  const renderMobileCard = (loan: Loan) => {
    const statusInfo = getLoanStatusBadge(loan);
    const { monthlyPayment } = calculateMonthlyPayment(loan);
    
    return (
      <MobileCard
        key={loan.id}
        fields={[
          { label: "Member", value: loan.account.user.full_name },
          { label: "Amount", value: `UGX ${loan.amount.toLocaleString()}` },
          { label: "Outstanding", value: `UGX ${loan.outstanding_balance.toLocaleString()}` },
          { label: "Repayment Plan", value: `${loan.repayment_months || 1} month(s) @ UGX ${monthlyPayment.toLocaleString()}/mo` },
          { 
            label: "Guarantor", 
            value: loan.guarantor_account ? (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{loan.guarantor_account.user.full_name}</span>
                {getGuarantorStatusBadge(loan.guarantor_status)}
              </div>
            ) : "—" 
          },
          { label: "Date", value: format(new Date(loan.created_at), "MMM dd, yyyy") },
        ]}
        status={{ label: statusInfo.label, variant: statusInfo.variant }}
        actions={renderLoanActions(loan)}
      />
    );
  };

  const renderTable = () => (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Date</TableHead>
            <TableHead>Member</TableHead>
            <TableHead className="hidden md:table-cell">Account</TableHead>
            <TableHead className="hidden lg:table-cell">Guarantor</TableHead>
            <TableHead className="hidden sm:table-cell">G. Status</TableHead>
            <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
            <TableHead className="hidden md:table-cell text-right">Rate/Mo</TableHead>
            <TableHead className="hidden sm:table-cell text-center">Plan</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Total</TableHead>
            <TableHead className="text-right whitespace-nowrap">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLoans.map((loan) => {
            const statusInfo = getLoanStatusBadge(loan);
            const { monthlyPayment } = calculateMonthlyPayment(loan);
            return (
              <TableRow key={loan.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {format(new Date(loan.created_at), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="font-medium text-xs sm:text-sm">
                  {loan.account.user.full_name}
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono text-[10px]">
                  {loan.account.account_number}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {loan.guarantor_account ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 text-xs">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="truncate max-w-[80px]">
                            {loan.guarantor_account.user.full_name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Account: {loan.guarantor_account.account_number}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {getGuarantorStatusBadge(loan.guarantor_status)}
                  {!loan.guarantor_account_id && "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-[10px] sm:text-xs">
                  UGX {loan.amount.toLocaleString()}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right text-xs">
                  {loan.interest_rate}%/mo
                </TableCell>
                <TableCell className="hidden sm:table-cell text-center text-xs">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-[9px]">
                          {loan.repayment_months || 1} mo
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        UGX {monthlyPayment.toLocaleString()}/month
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-right text-xs">
                  UGX {loan.total_amount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-[10px] sm:text-xs font-medium">
                  UGX {loan.outstanding_balance.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusInfo.variant} className="text-[8px] sm:text-[10px]">
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    {renderLoanActions(loan)}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg md:text-xl">Loans Management</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Disbursed loans stay active until fully repaid
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
        {/* Loan Status Tabs */}
        <div className="pb-3 sm:pb-4">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50 rounded-lg w-full justify-start">
              <TabsTrigger value="all" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                All ({loans.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                <Clock className="h-3 w-3 mr-1" />
                Pending ({loans.filter(l => l.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                <Check className="h-3 w-3 mr-1 text-blue-500" />
                Approved ({loans.filter(l => l.status === "approved").length})
              </TabsTrigger>
              <TabsTrigger value="active" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                Active ({loans.filter(l => ["disbursed", "active"].includes(l.status)).length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                <CheckCircle2 className="h-3 w-3 mr-1 text-purple-500" />
                Completed ({loans.filter(l => l.status === "completed" || l.status === "fully_paid").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* Search Bar */}
        <div className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by member name or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <MobileCardList
          items={filteredLoans}
          renderCard={renderMobileCard}
          renderTable={renderTable}
          emptyMessage="No loan applications found"
        />
      </CardContent>
      </Card>

      {/* Guarantor Management Dialog */}
    <Dialog open={guarantorDialogOpen} onOpenChange={setGuarantorDialogOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Manage Guarantor</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Assign or change guarantor for {selectedLoan?.account.user.full_name}'s loan
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loadingGuarantors ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Guarantor</Label>
                <Select value={selectedGuarantor} onValueChange={setSelectedGuarantor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a guarantor" />
                  </SelectTrigger>
                  <SelectContent>
                    {guarantorCandidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.full_name} ({candidate.account_number}) - UGX {candidate.total_savings.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {guarantorCandidates.length === 0 && (
                  <p className="text-xs text-muted-foreground">No eligible guarantors found</p>
                )}
              </div>
              <Button 
                onClick={handleSetGuarantor} 
                className="w-full"
                disabled={!selectedGuarantor}
              >
                <Users className="mr-2 h-4 w-4" />
                Assign Guarantor
              </Button>
            </>
          )}
        </div>
        </DialogContent>
      </Dialog>

      {/* Edit Loan Details Dialog */}
      <Dialog open={editLoanDialogOpen} onOpenChange={setEditLoanDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Edit Loan Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update loan details for {selectedLoan?.account.user.full_name}
            </DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                <p><span className="font-medium">Loan Amount:</span> UGX {selectedLoan.amount.toLocaleString()}</p>
                <p><span className="font-medium">Interest Rate:</span> {selectedLoan.interest_rate}% per month</p>
                <p><span className="font-medium">Total Repayable:</span> UGX {selectedLoan.total_amount.toLocaleString()}</p>
                <p><span className="font-medium">Outstanding:</span> UGX {selectedLoan.outstanding_balance.toLocaleString()}</p>
                <p><span className="font-medium">Repaid:</span> UGX {(selectedLoan.total_amount - selectedLoan.outstanding_balance).toLocaleString()}</p>
              </div>
              
              {/* Repayment Duration */}
              <div className="space-y-2">
                <Label>Repayment Duration (Months)</Label>
                <Input 
                  type="number"
                  min={1}
                  value={editRepaymentMonths}
                  onChange={(e) => setEditRepaymentMonths(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Monthly payment: UGX {((selectedLoan.amount + (selectedLoan.amount * selectedLoan.interest_rate / 100 * editRepaymentMonths)) / editRepaymentMonths).toLocaleString()}
                </p>
              </div>
              
              {/* Disbursement Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Disbursement Date
                </Label>
                <Input 
                  type="date"
                  value={editDisbursedAt}
                  onChange={(e) => setEditDisbursedAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Interest calculation starts from this date
                </p>
              </div>
              
              {/* Guarantor Assignment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Guarantor
                </Label>
                {loadingGuarantors ? (
                  <div className="flex justify-center p-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <Select value={editGuarantor || "none"} onValueChange={setEditGuarantor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select guarantor (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No guarantor</SelectItem>
                      {guarantorCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.full_name} ({candidate.account_number}) - UGX {candidate.total_savings.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {guarantorCandidates.length === 0 && !loadingGuarantors && (
                  <p className="text-xs text-muted-foreground">No eligible guarantors available</p>
                )}
              </div>
              
              <Button 
                onClick={handleUpdateLoanDetails} 
                className="w-full"
              >
                <Edit className="mr-2 h-4 w-4" />
                Update Loan Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoansManagement;
