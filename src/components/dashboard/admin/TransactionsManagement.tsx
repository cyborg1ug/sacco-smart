import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Plus, Loader2, FileText, Banknote, TrendingUp, TrendingDown, CreditCard, Wallet, CalendarIcon, Trash2, Users, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { generateTransactionReceiptPDF } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";
import { MobileCardList, MobileCard } from "@/components/ui/MobileCardList";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface Transaction {
  id: string;
  tnx_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  loan_id: string | null;
  receipt_number: string | null;
  account: {
    id: string;
    account_number: string;
    user: {
      full_name: string;
    };
  };
  loan?: {
    id: string;
    amount: number;
    outstanding_balance: number;
    total_amount: number;
    status: string;
  };
}

interface ActiveLoan {
  id: string;
  account_id: string;
  amount: number;
  total_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  status: string;
  account_number: string;
  member_name: string;
}

interface TransactionsManagementProps {
  onUpdate: () => void;
}

const TransactionsManagement = ({ onUpdate }: TransactionsManagementProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [receiptNumberDialogOpen, setReceiptNumberDialogOpen] = useState(false);
  const [selectedTransactionForReceipt, setSelectedTransactionForReceipt] = useState<Transaction | null>(null);
  const [receiptNumberInput, setReceiptNumberInput] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [selectedAccountForLoan, setSelectedAccountForLoan] = useState<string>("");
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>("");
  useEffect(() => {
    loadTransactions();
    loadMembers();
    loadActiveLoans();
  }, []);

  const loadTransactions = async () => {
    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!transactionsData) {
      setLoading(false);
      return;
    }

    // Get account IDs and fetch accounts
    const accountIds = [...new Set(transactionsData.map(t => t.account_id))];
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

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const subAccountProfilesMap = new Map(subAccountProfilesData?.map(p => [p.account_id, p]) || []);

    const accountsMap = new Map(accountsData.map(a => {
      let fullName = "Unknown";
      if (a.account_type === 'sub') {
        const subProfile = subAccountProfilesMap.get(a.id);
        fullName = subProfile?.full_name || "Unknown";
      } else {
        const profile = profilesMap.get(a.user_id);
        fullName = profile?.full_name || "Unknown";
      }
      return [a.id, {
        ...a,
        user: { full_name: fullName }
      }];
    }));

    const transactionsWithAccounts = transactionsData.map(t => ({
      ...t,
      account: accountsMap.get(t.account_id) || { id: t.account_id, account_number: "Unknown", user: { full_name: "Unknown" } }
    }));

    setTransactions(transactionsWithAccounts as any);
    setLoading(false);
  };

  const loadMembers = async () => {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, balance, user_id, account_type");

    if (!accountsData) return;

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

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const subAccountProfilesMap = new Map(subAccountProfilesData?.map(p => [p.account_id, p]) || []);

    const membersWithProfiles = accountsData.map(a => {
      let fullName = "Unknown";
      if (a.account_type === 'sub') {
        const subProfile = subAccountProfilesMap.get(a.id);
        fullName = subProfile?.full_name || "Unknown";
      } else {
        const profile = profilesMap.get(a.user_id);
        fullName = profile?.full_name || "Unknown";
      }
      return {
        ...a,
        user: { full_name: fullName }
      };
    });

    setMembers(membersWithProfiles);
  };

  const loadActiveLoans = async () => {
    // Load all active (approved, disbursed, or active) loans with outstanding balance > 0
    const { data: loansData } = await supabase
      .from("loans")
      .select("id, account_id, amount, total_amount, outstanding_balance, interest_rate, status")
      .in("status", ["approved", "disbursed", "active"])
      .gt("outstanding_balance", 0);

    if (!loansData) return;

    // Get account info for these loans
    const accountIds = [...new Set(loansData.map(l => l.account_id))];
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type")
      .in("id", accountIds);

    if (!accountsData) return;

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

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const subAccountProfilesMap = new Map(subAccountProfilesData?.map(p => [p.account_id, p]) || []);

    const accountsMap = new Map(accountsData.map(a => {
      let fullName = "Unknown";
      if (a.account_type === 'sub') {
        const subProfile = subAccountProfilesMap.get(a.id);
        fullName = subProfile?.full_name || "Unknown";
      } else {
        const profile = profilesMap.get(a.user_id);
        fullName = profile?.full_name || "Unknown";
      }
      return [a.id, { account_number: a.account_number, member_name: fullName }];
    }));

    const loansWithAccounts: ActiveLoan[] = loansData.map(l => ({
      ...l,
      account_number: accountsMap.get(l.account_id)?.account_number || "Unknown",
      member_name: accountsMap.get(l.account_id)?.member_name || "Unknown"
    }));

    setActiveLoans(loansWithAccounts);
  };

  // Get active loan for selected account
  const getActiveLoanForAccount = (accountId: string) => {
    return activeLoans.find(loan => loan.account_id === accountId);
  };

  const handleApprove = async (transactionId: string, accountId: string, amount: number, type: string, loanId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: account } = await supabase
      .from("accounts")
      .select("balance, total_savings")
      .eq("id", accountId)
      .single();

    if (!account) return;

    // Validate sufficient balance for withdrawals and loan repayments
    if (type === "withdrawal" || type === "loan_repayment") {
      if (account.balance < amount) {
        toast({
          title: "Insufficient Balance",
          description: `Cannot process ${type.replace("_", " ")}. Available balance: UGX ${account.balance.toLocaleString()}, Requested: UGX ${amount.toLocaleString()}`,
          variant: "destructive",
        });
        return;
      }
    }

    let newBalance = account.balance;
    let newTotalSavings = account.total_savings;

    if (type === "deposit") {
      newBalance += amount;
      newTotalSavings += amount;
    } else if (type === "withdrawal") {
      newBalance -= amount;
    } else if (type === "loan_disbursement") {
      newBalance += amount;
    } else if (type === "loan_repayment") {
      newBalance -= amount;
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ balance: newBalance, total_savings: newTotalSavings })
      .eq("id", accountId);

    if (updateError) {
      toast({
        title: "Error",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    // If this is a loan repayment, update the loan's outstanding balance
    if (type === "loan_repayment" && loanId) {
      const { data: loan } = await supabase
        .from("loans")
        .select("outstanding_balance, amount, total_amount, account_id")
        .eq("id", loanId)
        .single();

      if (loan) {
        const newOutstanding = Math.max(0, loan.outstanding_balance - amount);
        const newStatus = newOutstanding <= 0 ? "completed" : undefined;

        const updateData: any = { outstanding_balance: newOutstanding };
        if (newStatus) {
          updateData.status = newStatus;
        }

        await supabase
          .from("loans")
          .update(updateData)
          .eq("id", loanId);

        // Send notification when loan is completed
        if (newOutstanding <= 0) {
          toast({
            title: "🎉 Loan Completed",
            description: "This loan has been fully repaid",
          });

          // Get member details for notification
          const transaction = transactions.find(t => t.id === transactionId);
          if (transaction) {
            try {
              const { data: accountData } = await supabase
                .from("accounts")
                .select("user_id")
                .eq("id", loan.account_id)
                .single();

              if (accountData) {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("full_name, email")
                  .eq("id", accountData.user_id)
                  .single();

                await supabase.functions.invoke("loan-status-notification", {
                  body: {
                    loanId,
                    newStatus: "completed",
                    memberName: profile?.full_name || "Member",
                    memberEmail: profile?.email,
                    loanAmount: loan.amount,
                    outstandingBalance: 0,
                    accountId: loan.account_id,
                  },
                });
              }
            } catch (notifError) {
              console.error("Error sending completion notification:", notifError);
            }
          }
        }
      }
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        balance_after: newBalance,
      })
      .eq("id", transactionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction approved successfully",
      });
      
      // Auto-generate receipt in background
      supabase.functions.invoke('generate-receipt', {
        body: { transactionId }
      }).then(({ error: receiptError }) => {
        if (receiptError) {
          console.error('Error generating receipt:', receiptError);
        } else {
          console.log('Receipt generated automatically');
        }
      });
      
      loadTransactions();
      loadActiveLoans();
      onUpdate();
    }
  };

  const handleReject = async (transactionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("transactions")
      .update({
        status: "rejected",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction rejected",
      });
      loadTransactions();
      onUpdate();
    }
  };

  const handleDelete = async (transactionId: string) => {
    // First get the transaction details to reverse the balance changes if it was approved
    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (!transaction) {
      toast({
        title: "Error",
        description: "Transaction not found",
        variant: "destructive",
      });
      return;
    }

    // If transaction was approved, reverse the balance changes
    if (transaction.status === "approved") {
      const { data: account } = await supabase
        .from("accounts")
        .select("balance, total_savings")
        .eq("id", transaction.account_id)
        .single();

      if (account) {
        let newBalance = account.balance;
        let newTotalSavings = account.total_savings;

        // Reverse the transaction effect
        if (transaction.transaction_type === "deposit") {
          newBalance -= transaction.amount;
          newTotalSavings -= transaction.amount;
        } else if (transaction.transaction_type === "withdrawal") {
          newBalance += transaction.amount;
        } else if (transaction.transaction_type === "loan_disbursement") {
          newBalance -= transaction.amount;
        } else if (transaction.transaction_type === "loan_repayment") {
          newBalance += transaction.amount;
          // Also reverse the loan outstanding balance change
          if (transaction.loan_id) {
            const { data: loan } = await supabase
              .from("loans")
              .select("outstanding_balance, status")
              .eq("id", transaction.loan_id)
              .single();
            
            if (loan) {
              await supabase
                .from("loans")
                .update({ 
                  outstanding_balance: loan.outstanding_balance + transaction.amount,
                  status: "disbursed" // Revert to disbursed if it was completed
                })
                .eq("id", transaction.loan_id);
            }
          }
        }

        await supabase
          .from("accounts")
          .update({ balance: newBalance, total_savings: newTotalSavings })
          .eq("id", transaction.account_id);
      }
    }

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction deleted and balances updated",
      });
      loadTransactions();
      loadActiveLoans();
      onUpdate();
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const accountId = formData.get("accountId") as string;
    const type = formData.get("type") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const description = formData.get("description") as string;
    const loanId = formData.get("loanId") as string | null;

    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", accountId)
      .single();

    if (!account) return;

    // For loan repayments, validate against loan outstanding balance
    if (type === "loan_repayment" && loanId) {
      const loan = activeLoans.find(l => l.id === loanId);
      if (loan && amount > loan.outstanding_balance) {
        toast({
          title: "Amount Exceeds Loan Balance",
          description: `The repayment amount cannot exceed the outstanding balance of UGX ${loan.outstanding_balance.toLocaleString()}`,
          variant: "destructive",
        });
        return;
      }
    }

    const { error } = await supabase
      .from("transactions")
      .insert({
        account_id: accountId,
        transaction_type: type,
        amount,
        description,
        balance_after: account.balance,
        status: "pending",
        loan_id: type === "loan_repayment" && loanId ? loanId : null,
      } as any);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Transaction created successfully",
      });
      setDialogOpen(false);
      setSelectedAccountForLoan("");
      setSelectedTransactionType("");
      loadTransactions();
      loadActiveLoans();
    }
  };

  const handleProcessWithdrawal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const accountId = formData.get("accountId") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const description = formData.get("description") as string;

    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", accountId)
      .single();

    if (!account) {
      toast({
        title: "Error",
        description: "Account not found",
        variant: "destructive",
      });
      return;
    }

    if (account.balance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Available balance: UGX ${account.balance.toLocaleString()}, Requested: UGX ${amount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .insert({
        account_id: accountId,
        transaction_type: "withdrawal",
        amount,
        description,
        balance_after: account.balance,
        status: "pending",
      } as any);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Withdrawal transaction created successfully",
      });
      setWithdrawalDialogOpen(false);
      loadTransactions();
    }
  };

  const handleGenerateReceipt = async (transaction: Transaction) => {
    // Fetch current account balance
    const { data: accountData } = await supabase
      .from("accounts")
      .select("balance, total_savings")
      .eq("id", transaction.account.id)
      .single();

    generateTransactionReceiptPDF({
      tnxId: transaction.tnx_id,
      memberName: transaction.account.user.full_name,
      accountNumber: transaction.account.account_number,
      transactionType: transaction.transaction_type,
      amount: transaction.amount,
      balanceAfter: transaction.balance_after,
      currentBalance: accountData?.balance || transaction.balance_after,
      totalSavings: accountData?.total_savings || 0,
      description: transaction.description,
      createdAt: transaction.created_at,
      approvedAt: transaction.approved_at || undefined,
    });
    toast({
      title: "Receipt Generated",
      description: `Receipt for transaction ${transaction.tnx_id} has been downloaded.`,
    });
  };

  const openReceiptNumberDialog = (transaction: Transaction) => {
    setSelectedTransactionForReceipt(transaction);
    setReceiptNumberInput("");
    setReceiptNumberDialogOpen(true);
  };

  const handleAddReceiptNumber = async () => {
    if (!selectedTransactionForReceipt || !receiptNumberInput.trim()) return;

    const { error } = await supabase
      .from("transactions")
      .update({ receipt_number: receiptNumberInput.trim() })
      .eq("id", selectedTransactionForReceipt.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Receipt number added to transaction ${selectedTransactionForReceipt.tnx_id}`,
      });
      setReceiptNumberDialogOpen(false);
      loadTransactions();
    }
  };

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    
    return transactions.filter(t => {
      const txDate = new Date(t.created_at);
      
      switch (dateFilter) {
        case "today":
          return isWithinInterval(txDate, { start: startOfDay(now), end: endOfDay(now) });
        case "week":
          return isWithinInterval(txDate, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
        case "month":
          return isWithinInterval(txDate, { start: startOfMonth(now), end: endOfMonth(now) });
        case "custom":
          if (customDateFrom && customDateTo) {
            return isWithinInterval(txDate, { start: startOfDay(customDateFrom), end: endOfDay(customDateTo) });
          }
          return true;
        default:
          return true;
      }
    });
  }, [transactions, dateFilter, customDateFrom, customDateTo]);

  // Calculate transaction statistics from filtered transactions
  const stats = useMemo(() => ({
    totalDeposits: filteredTransactions
      .filter(t => t.transaction_type === "deposit" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    totalWithdrawals: filteredTransactions
      .filter(t => t.transaction_type === "withdrawal" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    totalLoanDisbursements: filteredTransactions
      .filter(t => t.transaction_type === "loan_disbursement" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    totalLoanRepayments: filteredTransactions
      .filter(t => t.transaction_type === "loan_repayment" && t.status === "approved")
      .reduce((sum, t) => sum + t.amount, 0),
    pendingCount: filteredTransactions.filter(t => t.status === "pending").length,
  }), [filteredTransactions]);

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "custom": 
        if (customDateFrom && customDateTo) {
          return `${format(customDateFrom, "MMM dd")} - ${format(customDateTo, "MMM dd, yyyy")}`;
        }
        return "Custom Range";
      default: return "All Time";
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Filter by:</span>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button 
            variant={dateFilter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("all")}
            className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
          >
            All
          </Button>
          <Button 
            variant={dateFilter === "today" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("today")}
            className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
          >
            Today
          </Button>
          <Button 
            variant={dateFilter === "week" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("week")}
            className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
          >
            Week
          </Button>
          <Button 
            variant={dateFilter === "month" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("month")}
            className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
          >
            Month
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={dateFilter === "custom" ? "default" : "outline"} 
                size="sm"
                className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs gap-1"
              >
                <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Custom</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 sm:p-4" align="start">
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 sm:h-9 text-xs sm:text-sm",
                          !customDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {customDateFrom ? format(customDateFrom, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-8 sm:h-9 text-xs sm:text-sm",
                          !customDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {customDateTo ? format(customDateTo, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        disabled={(date) => customDateFrom ? date < customDateFrom : false}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button 
                  className="w-full h-8 sm:h-9 text-xs sm:text-sm" 
                  size="sm"
                  onClick={() => setDateFilter("custom")}
                  disabled={!customDateFrom || !customDateTo}
                >
                  Apply Range
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {dateFilter !== "all" && (
          <Badge variant="secondary" className="shrink-0 text-[9px] sm:text-[10px]">
            {getDateFilterLabel()}
          </Badge>
        )}
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-success shrink-0" />
              <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Deposits</span>
            </div>
            <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalDeposits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-destructive shrink-0" />
              <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Withdrawals</span>
            </div>
            <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalWithdrawals.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
              <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Disbursed</span>
            </div>
            <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalLoanDisbursements.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 shrink-0" />
              <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Repayments</span>
            </div>
            <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1 truncate">UGX {stats.totalLoanRepayments.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-2.5 sm:pt-4 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 text-warning shrink-0" />
              <span className="text-[10px] sm:text-sm text-muted-foreground truncate">Pending</span>
            </div>
            <p className="text-sm sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1">{stats.pendingCount} txns</p>
          </CardContent>
        </Card>
      </div>

      <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg md:text-xl">Transactions</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5">Review and manage all transactions</CardDescription>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 sm:shrink-0">
              <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full xs:w-auto justify-center h-8 sm:h-9 text-xs sm:text-sm">
                    <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                    <span>Withdraw</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Process Withdrawal</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">Admin-only: Process a withdrawal for a member</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleProcessWithdrawal} className="space-y-3 sm:space-y-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="withdrawalAccountId" className="text-xs sm:text-sm">Member Account</Label>
                      <Select name="accountId" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.user.full_name} - {member.account_number} (Bal: UGX {member.balance.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="withdrawalAmount" className="text-xs sm:text-sm">Amount (UGX)</Label>
                      <Input id="withdrawalAmount" name="amount" type="number" step="0.01" min="1" required />
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="withdrawalDescription" className="text-xs sm:text-sm">Description</Label>
                      <Input id="withdrawalDescription" name="description" placeholder="Reason for withdrawal" />
                    </div>
                    <Button type="submit" className="w-full">Process Withdrawal</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full xs:w-auto justify-center h-8 sm:h-9 text-xs sm:text-sm">
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                    <span>New Txn</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">Create Transaction</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">Record a transaction for a member</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTransaction} className="space-y-3 sm:space-y-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="accountId" className="text-xs sm:text-sm">Member Account</Label>
                    <Select 
                      name="accountId" 
                      required 
                      value={selectedAccountForLoan}
                      onValueChange={(value) => setSelectedAccountForLoan(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.user.full_name} - {member.account_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="type" className="text-xs sm:text-sm">Transaction Type</Label>
                    <Select 
                      name="type" 
                      required
                      value={selectedTransactionType}
                      onValueChange={(value) => setSelectedTransactionType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Saving Deposit</SelectItem>
                        <SelectItem value="loan_disbursement">Loan Disbursement</SelectItem>
                        <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Show active loan info when loan_repayment is selected */}
                  {selectedTransactionType === "loan_repayment" && selectedAccountForLoan && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-xs sm:text-sm">Active Loan</Label>
                      {(() => {
                        const activeLoan = getActiveLoanForAccount(selectedAccountForLoan);
                        if (activeLoan) {
                          return (
                            <div className="p-2 sm:p-3 bg-muted rounded-md space-y-0.5 sm:space-y-1 text-xs sm:text-sm">
                              <input type="hidden" name="loanId" value={activeLoan.id} />
                              <p><span className="font-medium">Loan:</span> UGX {activeLoan.amount.toLocaleString()}</p>
                              <p><span className="font-medium">Total ({activeLoan.interest_rate}%):</span> UGX {activeLoan.total_amount.toLocaleString()}</p>
                              <p className="font-semibold text-primary"><span className="font-medium">Outstanding:</span> UGX {activeLoan.outstanding_balance.toLocaleString()}</p>
                            </div>
                          );
                        }
                        return (
                          <p className="text-xs sm:text-sm text-muted-foreground p-2 sm:p-3 bg-muted rounded-md">
                            No active loan found for this account.
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="amount" className="text-xs sm:text-sm">Amount (UGX)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                    {selectedTransactionType === "loan_repayment" && selectedAccountForLoan && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Enter partial or full repayment amount
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="description" className="text-xs sm:text-sm">Description</Label>
                    <Input id="description" name="description" />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={selectedTransactionType === "loan_repayment" && selectedAccountForLoan && !getActiveLoanForAccount(selectedAccountForLoan)}
                  >
                    Create Transaction
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-4 md:p-6 pt-0">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">TXN ID</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="whitespace-nowrap">Member</TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-mono text-[9px] sm:text-[10px]">
                    <div className="flex flex-col">
                      <span className="truncate max-w-[60px] sm:max-w-none">{transaction.tnx_id}</span>
                      <span className="text-[9px] sm:hidden text-muted-foreground">
                        {format(new Date(transaction.created_at), "MMM dd")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs">{format(new Date(transaction.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto truncate max-w-[80px] sm:max-w-[100px] text-xs sm:text-sm"
                      onClick={() => navigate(`/admin/transactions/${transaction.account.id}`)}
                    >
                      {transaction.account.user.full_name}
                    </Button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-[10px]">{transaction.account.account_number}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="capitalize text-[10px] sm:text-xs">
                      {transaction.transaction_type.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className="text-[10px] sm:text-xs font-medium">UGX {transaction.amount.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="truncate max-w-[100px] block text-xs">{transaction.description || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        transaction.status === "approved" ? "default" :
                        transaction.status === "pending" ? "secondary" : "destructive"
                      }
                      className="text-[8px] sm:text-[10px]"
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5 sm:gap-1 justify-center">
                      {transaction.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApprove(
                              transaction.id,
                              transaction.account.id,
                              transaction.amount,
                              transaction.transaction_type,
                              transaction.loan_id
                            )}
                            title="Approve"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(transaction.id)}
                            title="Reject"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {transaction.status === "approved" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGenerateReceipt(transaction)}
                            title="Receipt"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openReceiptNumberDialog(transaction)}
                            title="Add Receipt #"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                      
                      {/* Delete button for all transactions - admin only */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Delete"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base sm:text-lg">Delete Transaction</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs sm:text-sm">
                              Delete transaction {transaction.tnx_id}? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2 sm:gap-0">
                            <AlertDialogCancel className="h-8 sm:h-9 text-xs sm:text-sm">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(transaction.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 sm:h-9 text-xs sm:text-sm"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    
    {/* Floating Action Button for Mobile */}
    {isMobile && (
      <FloatingActionButton
        actions={[
          {
            icon: Banknote,
            label: "Withdraw",
            onClick: () => setWithdrawalDialogOpen(true),
            variant: "warning",
          },
          {
            icon: Plus,
            label: "New Transaction",
            onClick: () => setDialogOpen(true),
          },
        ]}
      />
    )}

    {/* Receipt Number Dialog */}
    <Dialog open={receiptNumberDialogOpen} onOpenChange={setReceiptNumberDialogOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Add Receipt Number</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add manual receipt book reference for transaction {selectedTransactionForReceipt?.tnx_id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedTransactionForReceipt && (
            <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
              <p><span className="font-medium">Member:</span> {selectedTransactionForReceipt.account.user.full_name}</p>
              <p><span className="font-medium">Type:</span> {selectedTransactionForReceipt.transaction_type.replace("_", " ")}</p>
              <p><span className="font-medium">Amount:</span> UGX {selectedTransactionForReceipt.amount.toLocaleString()}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Receipt Number</Label>
            <Input 
              placeholder="e.g., RB-001234"
              value={receiptNumberInput}
              onChange={(e) => setReceiptNumberInput(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleAddReceiptNumber} 
            className="w-full"
            disabled={!receiptNumberInput.trim()}
          >
            <Edit className="mr-2 h-4 w-4" />
            Add Receipt Number
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export default TransactionsManagement;
