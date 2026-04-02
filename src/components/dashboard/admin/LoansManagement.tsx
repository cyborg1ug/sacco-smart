import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Send, Loader2, Users, UserPlus, CheckCircle, Edit, Clock, CheckCircle2, TrendingUp, Search, Calendar, AlertTriangle, Zap, Eye, Target, PieChart as PieChartIcon } from "lucide-react";
import { format, differenceInMonths, differenceInDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MobileCardList, MobileCard } from "@/components/ui/MobileCardList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";

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
  purpose: string | null;
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
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedGuarantor, setSelectedGuarantor] = useState("");
  const [guarantorCandidates, setGuarantorCandidates] = useState<any[]>([]);
  const [loadingGuarantors, setLoadingGuarantors] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);
  const [applyingOverdue, setApplyingOverdue] = useState(false);
  const [overdueResult, setOverdueResult] = useState<{ updated: number; skipped: number; message: string } | null>(null);

  // Edit form state
  const [editRepaymentMonths, setEditRepaymentMonths] = useState<number>(1);
  const [editDisbursedAt, setEditDisbursedAt] = useState<string>("");
  const [editGuarantor, setEditGuarantor] = useState<string>("");

  const isLoanOverdue = (loan: Loan): boolean => {
    if (!loan.disbursed_at || !loan.repayment_months) return false;
    if (loan.outstanding_balance <= 0) return false;
    const monthsElapsed = differenceInMonths(new Date(), new Date(loan.disbursed_at));
    return monthsElapsed > loan.repayment_months;
  };

  const getDaysOverdue = (loan: Loan): number => {
    if (!loan.disbursed_at || !loan.repayment_months) return 0;
    const dueDate = new Date(loan.disbursed_at);
    dueDate.setMonth(dueDate.getMonth() + loan.repayment_months);
    if (new Date() <= dueDate) return 0;
    return differenceInDays(new Date(), dueDate);
  };

  const calcDailyOverdueInterest = (loan: Loan): number => {
    const days = getDaysOverdue(loan);
    if (days <= 0) return 0;
    const dailyRate = (Number(loan.interest_rate) / 100) / 30;
    return Math.round(Number(loan.amount) * dailyRate * days);
  };

  // Generate loan display ID
  const getLoanDisplayId = (loan: Loan, index: number) => {
    const year = new Date(loan.created_at).getFullYear();
    const num = String(index + 1).padStart(3, "0");
    return `LN-${year}-${num}`;
  };

  // Filter loans by status and search
  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      if (statusFilter !== "all") {
        const overdue = isLoanOverdue(loan);
        if (statusFilter === "overdue" && !overdue) return false;
        if (statusFilter === "pending" && loan.status !== "pending") return false;
        if (statusFilter === "approved" && loan.status !== "approved" && !(loan.status === "active" && !loan.disbursed_at)) return false;
        if (statusFilter === "active" && (!["disbursed", "active"].includes(loan.status) || !loan.disbursed_at || overdue)) return false;
        if (statusFilter === "completed" && loan.status !== "completed" && loan.status !== "fully_paid") return false;
        if (statusFilter === "rejected" && loan.status !== "rejected") return false;
      }
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          loan.account.user.full_name.toLowerCase().includes(query) ||
          loan.account.account_number.toLowerCase().includes(query) ||
          (loan.purpose || "").toLowerCase().includes(query) ||
          loan.guarantor_account?.user?.full_name?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [loans, statusFilter, searchQuery]);

  const overdueCount = useMemo(() => loans.filter(l => isLoanOverdue(l)).length, [loans]);
  const activeCount = useMemo(() => loans.filter(l => ["disbursed", "active"].includes(l.status) && l.disbursed_at && !isLoanOverdue(l)).length, [loans]);
  const approvedCount = useMemo(() => loans.filter(l => l.status === "approved" || (l.status === "active" && !l.disbursed_at)).length, [loans]);
  const rejectedCount = useMemo(() => loans.filter(l => l.status === "rejected").length, [loans]);

  // Metrics calculations
  const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--accent))", "#8884d8", "#ffc658", "#82ca9d"];

  const loanRepaymentIndex = useMemo(() => {
    const repayableLoans = loans.filter(l => ["disbursed", "active", "fully_paid", "completed"].includes(l.status));
    if (repayableLoans.length === 0) return 0;
    const totalExpected = repayableLoans.reduce((s, l) => s + Number(l.total_amount), 0);
    const totalRepaid = repayableLoans.reduce((s, l) => s + (Number(l.total_amount) - Number(l.outstanding_balance)), 0);
    return totalExpected > 0 ? Math.round((totalRepaid / totalExpected) * 100) : 0;
  }, [loans]);

  const savingsReliabilityIndex = useMemo(() => {
    // Based on how many active/completed loans vs overdue/defaulted
    const activeLoanCount = loans.filter(l => ["disbursed", "active", "fully_paid", "completed"].includes(l.status)).length;
    if (activeLoanCount === 0) return 100;
    const goodLoans = loans.filter(l => ["fully_paid", "completed"].includes(l.status) || (["disbursed", "active"].includes(l.status) && !isLoanOverdue(l))).length;
    return Math.round((goodLoans / activeLoanCount) * 100);
  }, [loans]);

  const purposeDistribution = useMemo(() => {
    const purposeMap = new Map<string, number>();
    loans.forEach(loan => {
      const purpose = loan.purpose || "Unspecified";
      purposeMap.set(purpose, (purposeMap.get(purpose) || 0) + 1);
    });
    return Array.from(purposeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [loans]);

  // Setup real-time subscription
  useEffect(() => {
    loadLoans();
    
    const loansChannel = supabase
      .channel('loans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => loadLoans())
      .subscribe();

    const transactionsChannel = supabase
      .channel('transactions-realtime-loans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload: any) => {
        if (payload.new?.transaction_type === 'loan_repayment' || 
            payload.new?.transaction_type === 'loan_disbursement' ||
            payload.old?.transaction_type === 'loan_repayment' ||
            payload.old?.transaction_type === 'loan_disbursement') {
          loadLoans();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(loansChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, []);

  const loadLoans = async () => {
    const { data: loansData } = await supabase
      .from("loans")
      .select("*")
      .order("created_at", { ascending: false });

    if (!loansData) { setLoading(false); return; }

    const accountIds = [...new Set([
      ...loansData.map(l => l.account_id),
      ...loansData.filter(l => l.guarantor_account_id).map(l => l.guarantor_account_id as string)
    ])];

    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type")
      .in("id", accountIds);

    if (!accountsData) { setLoading(false); return; }

    const mainAccountUserIds = [...new Set(accountsData.filter(a => a.account_type === 'main').map(a => a.user_id))];
    const subAccountIds = accountsData.filter(a => a.account_type === 'sub').map(a => a.id);

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

    const accountsMap = new Map(accountsData.map(a => {
      let fullName = "Unknown";
      if (a.account_type === 'sub') {
        fullName = subProfilesMap.get(a.id) || "Unknown";
      } else {
        fullName = profilesMap.get(a.user_id) || "Unknown";
      }
      return [a.id, { id: a.id, account_number: a.account_number, user: { full_name: fullName } }];
    }));

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
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type, total_savings");

    if (!accountsData) { setLoadingGuarantors(false); return; }

    const { data: activeGuarantorLoans } = await supabase
      .from("loans")
      .select("guarantor_account_id")
      .in("status", ["pending", "approved", "disbursed", "active"])
      .gt("outstanding_balance", 0)
      .not("guarantor_account_id", "is", null);

    const alreadyGuaranteeing = new Set(
      activeGuarantorLoans?.map(l => l.guarantor_account_id).filter(Boolean) || []
    );

    const loanAccount = accountsData.find(a => a.id === loanAccountId);
    const minSavings = loanAccount?.total_savings || 0;

    const eligibleAccounts = accountsData.filter(a => 
      a.id !== loanAccountId && 
      a.total_savings >= minSavings &&
      !alreadyGuaranteeing.has(a.id)
    );

    const mainAccountUserIds = [...new Set(eligibleAccounts.filter(a => a.account_type === 'main').map(a => a.user_id))];
    const subAccountIdsList = eligibleAccounts.filter(a => a.account_type === 'sub').map(a => a.id);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", mainAccountUserIds);

    const { data: subAccountProfilesData } = await supabase
      .from("sub_account_profiles")
      .select("account_id, full_name")
      .in("account_id", subAccountIdsList);

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
      .update({ guarantor_account_id: selectedGuarantor, guarantor_status: "pending" })
      .eq("id", selectedLoan.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Guarantor assigned successfully" });
      setGuarantorDialogOpen(false);
      loadLoans();
      onUpdate();
    }
  };

  const handleApproveGuarantor = async (loanId: string) => {
    const { error } = await supabase.from("loans").update({ guarantor_status: "approved" }).eq("id", loanId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Guarantor approved by admin" });
      loadLoans();
      onUpdate();
    }
  };

  const sendLoanNotification = async (loan: Loan, newStatus: string) => {
    try {
      const { data: accountData } = await supabase
        .from("accounts").select("user_id").eq("id", loan.account.id).single();
      if (accountData) {
        const { data: profile } = await supabase
          .from("profiles").select("email").eq("id", accountData.user_id).single();
        await supabase.functions.invoke("loan-status-notification", {
          body: {
            loanId: loan.id, newStatus,
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
    if (loan.guarantor_account_id && loan.guarantor_status !== "approved") {
      toast({ title: "Cannot Approve Yet", description: "The guarantor must approve this loan request first", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("loans")
      .update({ status: "active", approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", loan.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Loan approved and is now active" });
      sendLoanNotification({ ...loan, outstanding_balance: loan.total_amount }, "approved");
      loadLoans();
      onUpdate();
    }
  };

  const handleReject = async (loanId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const loan = loans.find(l => l.id === loanId);
    const { error } = await supabase.from("loans")
      .update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", loanId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Loan rejected" });
      if (loan) sendLoanNotification(loan, "rejected");
      loadLoans();
      onUpdate();
    }
  };

  const handleDisburse = async (loan: Loan) => {
    const { id: loanId, account, amount, total_amount } = loan;
    const accountId = account.id;
    const { error: loanError } = await supabase.from("loans")
      .update({ status: "disbursed", disbursed_at: new Date().toISOString() })
      .eq("id", loanId);

    if (loanError) { toast({ title: "Error", description: loanError.message, variant: "destructive" }); return; }

    const { data: accountData } = await supabase.from("accounts").select("balance").eq("id", accountId).single();
    if (!accountData) return;
    const newBalance = accountData.balance + amount;

    const { error: transactionError } = await supabase.from("transactions").insert({
      account_id: accountId,
      transaction_type: "loan_disbursement",
      amount,
      balance_after: newBalance,
      description: `Loan disbursement for loan ${loanId}`,
      status: "pending",
      loan_id: loanId,
    } as any);

    if (transactionError) {
      toast({ title: "Error", description: transactionError.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Loan disbursed - awaiting transaction approval" });
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

    const { data: repaymentData } = await supabase
      .from("transactions").select("amount")
      .eq("loan_id", selectedLoan.id).eq("transaction_type", "loan_repayment").eq("status", "approved");

    const totalRepaid = repaymentData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const monthlyInterest = selectedLoan.amount * (selectedLoan.interest_rate / 100);
    const totalInterest = monthlyInterest * editRepaymentMonths;
    const newTotalAmount = selectedLoan.amount + totalInterest;
    const newOutstanding = Math.max(0, newTotalAmount - totalRepaid);
    
    let newStatus = selectedLoan.status;
    if (newOutstanding <= 0) newStatus = "fully_paid";
    else if (selectedLoan.disbursed_at || editDisbursedAt) newStatus = "disbursed";

    const updateData: any = {
      repayment_months: editRepaymentMonths,
      total_amount: newTotalAmount,
      outstanding_balance: newOutstanding,
      status: newStatus,
    };

    if (editDisbursedAt) updateData.disbursed_at = new Date(editDisbursedAt).toISOString();
    const normalizedGuarantor = editGuarantor === "none" || editGuarantor === "" ? null : editGuarantor;
    if (normalizedGuarantor && normalizedGuarantor !== selectedLoan.guarantor_account_id) {
      updateData.guarantor_account_id = normalizedGuarantor;
      updateData.guarantor_status = "approved";
    } else if (!normalizedGuarantor && selectedLoan.guarantor_account_id) {
      updateData.guarantor_account_id = null;
      updateData.guarantor_status = null;
    }

    const { error } = await supabase.from("loans").update(updateData).eq("id", selectedLoan.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Loan details updated successfully" });
      setEditLoanDialogOpen(false);
      loadLoans();
      onUpdate();
    }
  };

  const handleApplyOverdueCharges = async () => {
    setApplyingOverdue(true);
    setOverdueResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/apply-overdue-interest`,
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` } }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to apply charges");
      setOverdueResult({ updated: result.updated, skipped: result.skipped, message: result.message });
      if (result.updated > 0) {
        loadLoans(); onUpdate();
        toast({ title: "Overdue Charges Applied", description: `2% penalty applied to ${result.updated} overdue loan(s)` });
      } else {
        toast({ title: "No Changes Needed", description: "No overdue loans require penalty charges this month" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApplyingOverdue(false);
    }
  };

  const getLoanStatusBadge = (loan: Loan) => {
    const overdue = isLoanOverdue(loan);
    if (overdue) return { label: "Overdue", variant: "destructive" as const };
    
    const isFullyRepaid = loan.outstanding_balance <= 0;
    if ((loan.status === "active" || loan.status === "disbursed") && isFullyRepaid) {
      return { label: "Completed", variant: "default" as const };
    }
    
    const displayStatus = loan.status === "disbursed" ? "active" : loan.status;
    switch (displayStatus) {
      case "active": return { label: "Active", variant: "default" as const };
      case "completed": return { label: "Completed", variant: "default" as const };
      case "approved": return { label: "Approved", variant: "secondary" as const };
      case "pending": return { label: "Pending", variant: "outline" as const };
      case "fully_paid": return { label: "Completed", variant: "default" as const };
      default: return { label: displayStatus, variant: "destructive" as const };
    }
  };

  const getRepaymentProgress = (loan: Loan) => {
    if (loan.total_amount <= 0) return { percent: 0, repaid: 0, remaining: 0 };
    const repaid = loan.total_amount - loan.outstanding_balance;
    const percent = Math.round((repaid / loan.total_amount) * 100);
    return { percent: Math.min(100, Math.max(0, percent)), repaid, remaining: loan.outstanding_balance };
  };

  const getDueDate = (loan: Loan) => {
    if (!loan.disbursed_at || !loan.repayment_months) return null;
    const due = new Date(loan.disbursed_at);
    due.setMonth(due.getMonth() + loan.repayment_months);
    return due;
  };

  const calculateMonthlyPayment = (loan: Loan) => {
    const monthlyInterest = loan.amount * (loan.interest_rate / 100);
    const totalInterest = monthlyInterest * (loan.repayment_months || 1);
    const totalWithInterest = loan.amount + totalInterest;
    const monthlyPayment = totalWithInterest / (loan.repayment_months || 1);
    return { monthlyPayment, totalInterest, totalWithInterest };
  };

  const openDetailsDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setDetailsDialogOpen(true);
  };

  const renderLoanActions = (loan: Loan) => {
    if (loan.status === "pending") {
      return (
        <div className="flex gap-1 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={() => openGuarantorDialog(loan)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                  <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Set/Change Guarantor</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {loan.guarantor_account_id && loan.guarantor_status === "pending" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => handleApproveGuarantor(loan.id)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
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
                <Button size="sm" variant="ghost" onClick={() => handleApprove(loan)}
                  disabled={loan.guarantor_account_id !== null && loan.guarantor_status !== "approved"}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {loan.guarantor_account_id && loan.guarantor_status !== "approved" ? "Waiting for guarantor approval" : "Approve loan"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" variant="ghost" onClick={() => handleReject(loan.id)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
          </Button>
        </div>
      );
    }
    
    if (["active", "disbursed", "approved", "fully_paid", "completed"].includes(loan.status)) {
      return (
        <div className="flex gap-1">
          {(loan.status === "approved" || (loan.status === "active" && !loan.disbursed_at)) && (
            <Button size="sm" onClick={() => handleDisburse(loan)}
              className="h-7 sm:h-8 text-[10px] sm:text-xs bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70">
              <Send className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Disburse
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={() => openEditLoanDialog(loan)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
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

  const renderMobileCard = (loan: Loan) => {
    const statusInfo = getLoanStatusBadge(loan);
    const progress = getRepaymentProgress(loan);
    const overdue = isLoanOverdue(loan);
    const penalty = overdue ? calcDailyOverdueInterest(loan) : 0;
    const loanIndex = loans.indexOf(loan);
    
    return (
      <MobileCard
        key={loan.id}
        fields={[
          { label: "Loan", value: getLoanDisplayId(loan, loans.length - 1 - loanIndex) },
          { label: "Member", value: loan.account.user.full_name },
          { label: "Purpose", value: loan.purpose || "—" },
          { label: "Amount", value: `UGX ${loan.amount.toLocaleString()}` },
          { label: "Balance", value: (
            <span className={overdue ? "text-destructive" : "text-primary"}>
              UGX {loan.outstanding_balance.toLocaleString()}
              {penalty > 0 && <span className="text-destructive text-[10px] block">+UGX {penalty.toLocaleString()} penalty</span>}
            </span>
          )},
          { label: "Progress", value: (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>{progress.percent}% repaid</span>
                <span>UGX {progress.remaining.toLocaleString()} left</span>
              </div>
              <Progress value={progress.percent} className={`h-1.5 ${overdue ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
            </div>
          )},
        ]}
        status={{ label: statusInfo.label, variant: statusInfo.variant }}
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => openDetailsDialog(loan)} className="h-7 w-7 p-0">
              <Eye className="h-3.5 w-3.5 text-primary" />
            </Button>
            {renderLoanActions(loan)}
          </div>
        }
      />
    );
  };

  const renderTable = () => (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Loan</TableHead>
            <TableHead>Member</TableHead>
            <TableHead className="hidden md:table-cell">Purpose</TableHead>
            <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
            <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
            <TableHead className="hidden sm:table-cell">Progress</TableHead>
            <TableHead className="hidden lg:table-cell">Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLoans.map((loan, idx) => {
            const statusInfo = getLoanStatusBadge(loan);
            const progress = getRepaymentProgress(loan);
            const overdue = isLoanOverdue(loan);
            const penalty = overdue ? calcDailyOverdueInterest(loan) : 0;
            const dueDate = getDueDate(loan);
            const loanIndex = loans.indexOf(loan);

            return (
              <TableRow key={loan.id}>
                <TableCell className="whitespace-nowrap">
                  <div>
                    <span className="text-primary font-medium text-xs">{getLoanDisplayId(loan, loans.length - 1 - loanIndex)}</span>
                    <div className="text-[10px] text-muted-foreground">{loan.interest_rate}% p.a.</div>
                    <div className="text-[10px] text-muted-foreground">{loan.repayment_months || 1}mo term</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-xs sm:text-sm text-primary cursor-pointer hover:underline">
                    {loan.account.user.full_name}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  {loan.purpose || "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-[10px] sm:text-xs tabular-nums">
                  UGX {loan.amount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div>
                    <span className={`text-[10px] sm:text-xs font-medium tabular-nums ${overdue ? "text-destructive" : "text-primary"}`}>
                      UGX {loan.outstanding_balance.toLocaleString()}
                    </span>
                    {penalty > 0 && (
                      <div className="text-[9px] text-destructive">+UGX {penalty.toLocaleString()} penalty</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell min-w-[160px]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{progress.percent}% repaid</span>
                      <span>UGX {progress.remaining.toLocaleString()} left</span>
                    </div>
                    <Progress value={progress.percent} className={`h-1.5 ${overdue ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs whitespace-nowrap">
                  {dueDate ? format(dueDate, "MMM yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusInfo.variant} className="text-[8px] sm:text-[10px]">
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => openDetailsDialog(loan)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Details</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg md:text-xl">Loan Management</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Full loan lifecycle — applications, approvals, disbursement & repayment
              </CardDescription>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setOverdueResult(null); setOverdueDialogOpen(true); }}
              className="flex items-center gap-2 shrink-0"
            >
              <Zap className="h-4 w-4" />
              Apply Overdue Charges
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Repayment Index</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-primary">{loanRepaymentIndex}%</p>
              <Progress value={loanRepaymentIndex} className="h-1.5 [&>div]:bg-primary" />
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-chart-2" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Savings Reliability</p>
              </div>
              <p className="text-xl font-bold tabular-nums" style={{ color: "hsl(var(--chart-2))" }}>{savingsReliabilityIndex}%</p>
              <Progress value={savingsReliabilityIndex} className="h-1.5 [&>div]:bg-chart-2" />
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Overdue Loans</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-destructive">{overdueCount}</p>
              <p className="text-[10px] text-muted-foreground">of {loans.filter(l => ["disbursed", "active"].includes(l.status)).length} active</p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-chart-4" />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total Portfolio</p>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {loans.length}
              </p>
              <p className="text-[10px] text-muted-foreground">{loans.filter(l => l.status === "pending").length} pending</p>
            </div>
          </div>

          {/* Purpose Distribution Chart */}
          {purposeDistribution.length > 0 && (
            <div className="border rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold mb-2">Loan Distribution by Purpose</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purposeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={10}>
                      {purposeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => [`${value} loan(s)`, "Count"]} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Loan Status Tabs */}
          <div className="pb-3 sm:pb-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50 rounded-lg w-full justify-start">
                <TabsTrigger value="all" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  All ({loans.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  Active ({activeCount})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  Overdue ({overdueCount})
                </TabsTrigger>
                <TabsTrigger value="pending" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending ({loans.filter(l => l.status === "pending").length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  Approved ({approvedCount})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Closed ({loans.filter(l => l.status === "completed" || l.status === "fully_paid").length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  Rejected ({rejectedCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {/* Search Bar */}
          <div className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member name, loan no, or purpose..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{filteredLoans.length} loans</span>
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

      {/* Loan Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Loan Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Full loan profile and repayment schedule</DialogDescription>
          </DialogHeader>
          {selectedLoan && (() => {
            const progress = getRepaymentProgress(selectedLoan);
            const overdue = isLoanOverdue(selectedLoan);
            const penalty = overdue ? calcDailyOverdueInterest(selectedLoan) : 0;
            const dueDate = getDueDate(selectedLoan);
            const statusInfo = getLoanStatusBadge(selectedLoan);
            const loanIndex = loans.indexOf(selectedLoan);
            const { monthlyPayment } = calculateMonthlyPayment(selectedLoan);

            return (
              <div className="space-y-4">
                {/* Loan ID and status */}
                <div className="flex items-center justify-between">
                  <span className="text-primary font-semibold text-sm">{getLoanDisplayId(selectedLoan, loans.length - 1 - loanIndex)}</span>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>
                
                {/* Member info */}
                <div>
                  <p className="font-semibold text-sm">{selectedLoan.account.user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedLoan.purpose || "No purpose specified"}</p>
                </div>

                {/* Key metrics grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Loan Amount</p>
                    <p className="font-bold text-sm tabular-nums">UGX {selectedLoan.amount.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Outstanding</p>
                    <p className={`font-bold text-sm tabular-nums ${overdue ? "text-destructive" : "text-primary"}`}>
                      UGX {selectedLoan.outstanding_balance.toLocaleString()}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Interest Rate</p>
                    <p className="font-bold text-sm">{selectedLoan.interest_rate}% p.a.</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Term</p>
                    <p className="font-bold text-sm">{selectedLoan.repayment_months || 1} months</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Monthly Payment</p>
                    <p className="font-bold text-sm tabular-nums text-primary">UGX {monthlyPayment.toLocaleString()}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">Penalty</p>
                    <p className="font-bold text-sm">{penalty > 0 ? `UGX ${penalty.toLocaleString()}` : "None"}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold">Repayment Progress</p>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{progress.percent}% repaid</span>
                    <span>UGX {progress.remaining.toLocaleString()} left</span>
                  </div>
                  <Progress value={progress.percent} className={`h-2 ${overdue ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
                  <div className="flex justify-between text-[10px]">
                    <span className="text-primary">Paid: UGX {progress.repaid.toLocaleString()}</span>
                    <span className={overdue ? "text-destructive" : "text-muted-foreground"}>Remaining: UGX {progress.remaining.toLocaleString()}</span>
                  </div>
                </div>

                {/* Guarantors */}
                {selectedLoan.guarantor_account && (
                  <div>
                    <p className="text-xs font-semibold mb-1">Guarantors</p>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedLoan.guarantor_account.user.full_name}
                    </Badge>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="border rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Applied</p>
                    <p className="font-medium text-xs">{format(new Date(selectedLoan.created_at), "dd MMM yyyy")}</p>
                  </div>
                  <div className="border rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Disbursed</p>
                    <p className="font-medium text-xs">{selectedLoan.disbursed_at ? format(new Date(selectedLoan.disbursed_at), "dd MMM yyyy") : "—"}</p>
                  </div>
                  <div className="border rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Due Date</p>
                    <p className="font-medium text-xs">{dueDate ? format(dueDate, "dd MMM yyyy") : "—"}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Guarantor</Label>
                  <Select value={selectedGuarantor} onValueChange={setSelectedGuarantor}>
                    <SelectTrigger><SelectValue placeholder="Choose a guarantor" /></SelectTrigger>
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
                <Button onClick={handleSetGuarantor} className="w-full" disabled={!selectedGuarantor}>
                  <Users className="mr-2 h-4 w-4" /> Assign Guarantor
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
              
              <div className="space-y-2">
                <Label>Repayment Duration (Months)</Label>
                <Input type="number" min={1} value={editRepaymentMonths}
                  onChange={(e) => setEditRepaymentMonths(parseInt(e.target.value) || 1)} />
                <p className="text-xs text-muted-foreground">
                  Monthly payment: UGX {((selectedLoan.amount + (selectedLoan.amount * selectedLoan.interest_rate / 100 * editRepaymentMonths)) / editRepaymentMonths).toLocaleString()}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Disbursement Date</Label>
                <Input type="date" value={editDisbursedAt} onChange={(e) => setEditDisbursedAt(e.target.value)} />
                <p className="text-xs text-muted-foreground">Interest calculation starts from this date</p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Guarantor</Label>
                {loadingGuarantors ? (
                  <div className="flex justify-center p-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <Select value={editGuarantor || "none"} onValueChange={setEditGuarantor}>
                    <SelectTrigger><SelectValue placeholder="Select guarantor (optional)" /></SelectTrigger>
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
              
              <Button onClick={handleUpdateLoanDetails} className="w-full">
                <Edit className="mr-2 h-4 w-4" /> Update Loan Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Overdue Charges Confirmation Dialog */}
      <Dialog open={overdueDialogOpen} onOpenChange={setOverdueDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Apply Overdue Penalty Charges
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              This will apply a <strong>2% penalty</strong> on the principal amount to all loans that have exceeded their repayment period. Each loan is charged once per month.
            </DialogDescription>
          </DialogHeader>

          {overdueResult ? (
            <div className="space-y-3">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">{overdueResult.message}</p>
                  <div className="mt-2 text-xs space-y-1">
                    <p>✅ <strong>{overdueResult.updated}</strong> loan(s) charged with 2% overdue penalty</p>
                    <p>⏭ <strong>{overdueResult.skipped}</strong> loan(s) skipped (not overdue or already charged this month)</p>
                  </div>
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button onClick={() => setOverdueDialogOpen(false)} className="w-full">Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setOverdueDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={handleApplyOverdueCharges} disabled={applyingOverdue} className="flex-1">
                {applyingOverdue ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>) : (<><Zap className="mr-2 h-4 w-4" />Apply Charges</>)}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoansManagement;
