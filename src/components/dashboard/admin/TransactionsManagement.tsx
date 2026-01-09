import { useEffect, useState, useMemo } from "react";
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
import { Check, X, Plus, Loader2, FileText, Banknote, TrendingUp, TrendingDown, CreditCard, Wallet, CalendarIcon, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { generateTransactionReceiptPDF } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
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
    // Load all active (approved or disbursed) loans with outstanding balance > 0
    const { data: loansData } = await supabase
      .from("loans")
      .select("id, account_id, amount, total_amount, outstanding_balance, interest_rate, status")
      .in("status", ["approved", "disbursed"])
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

  const handleApprove = async (transactionId: string, accountId: string, amount: number, type: string) => {
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
        description: "Transaction deleted successfully",
      });
      loadTransactions();
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
    <div className="space-y-6">
      {/* Date Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={dateFilter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("all")}
          >
            All Time
          </Button>
          <Button 
            variant={dateFilter === "today" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("today")}
          >
            Today
          </Button>
          <Button 
            variant={dateFilter === "week" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("week")}
          >
            This Week
          </Button>
          <Button 
            variant={dateFilter === "month" ? "default" : "outline"} 
            size="sm"
            onClick={() => setDateFilter("month")}
          >
            This Month
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={dateFilter === "custom" ? "default" : "outline"} 
                size="sm"
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                Custom Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
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
                <div className="space-y-2">
                  <Label>To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
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
                  className="w-full" 
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
          <Badge variant="secondary" className="ml-2">
            Showing: {getDateFilterLabel()}
          </Badge>
        )}
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Total Deposits</span>
            </div>
            <p className="text-xl font-bold mt-1">UGX {stats.totalDeposits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Total Withdrawals</span>
            </div>
            <p className="text-xl font-bold mt-1">UGX {stats.totalWithdrawals.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Loan Disbursements</span>
            </div>
            <p className="text-xl font-bold mt-1">UGX {stats.totalLoanDisbursements.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Loan Repayments</span>
            </div>
            <p className="text-xl font-bold mt-1">UGX {stats.totalLoanRepayments.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.pendingCount} transactions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Transactions Management</CardTitle>
            <CardDescription>Review and manage all transactions</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Banknote className="mr-2 h-4 w-4" />
                  Process Withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Process Withdrawal</DialogTitle>
                  <DialogDescription>Admin-only: Process a withdrawal for a member</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleProcessWithdrawal} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdrawalAccountId">Member Account</Label>
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
                  <div className="space-y-2">
                    <Label htmlFor="withdrawalAmount">Amount (UGX)</Label>
                    <Input id="withdrawalAmount" name="amount" type="number" step="0.01" min="1" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withdrawalDescription">Description</Label>
                    <Input id="withdrawalDescription" name="description" placeholder="Reason for withdrawal" />
                  </div>
                  <Button type="submit" className="w-full">Process Withdrawal</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Transaction
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Transaction</DialogTitle>
                <DialogDescription>Record a transaction for a member</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Member Account</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="type">Transaction Type</Label>
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
                  <div className="space-y-2">
                    <Label>Active Loan</Label>
                    {(() => {
                      const activeLoan = getActiveLoanForAccount(selectedAccountForLoan);
                      if (activeLoan) {
                        return (
                          <div className="p-3 bg-muted rounded-md space-y-1">
                            <input type="hidden" name="loanId" value={activeLoan.id} />
                            <p className="text-sm"><span className="font-medium">Loan Amount:</span> UGX {activeLoan.amount.toLocaleString()}</p>
                            <p className="text-sm"><span className="font-medium">Total (with {activeLoan.interest_rate}% interest):</span> UGX {activeLoan.total_amount.toLocaleString()}</p>
                            <p className="text-sm font-semibold text-primary"><span className="font-medium">Outstanding Balance:</span> UGX {activeLoan.outstanding_balance.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">Status: {activeLoan.status}</p>
                          </div>
                        );
                      }
                      return (
                        <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                          No active loan found for this account.
                        </p>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (UGX)</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                  {selectedTransactionType === "loan_repayment" && selectedAccountForLoan && (
                    <p className="text-xs text-muted-foreground">
                      Enter partial or full repayment amount
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
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
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TXN ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-mono text-xs">{transaction.tnx_id}</TableCell>
                <TableCell>{format(new Date(transaction.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell>{transaction.account.user.full_name}</TableCell>
                <TableCell>{transaction.account.account_number}</TableCell>
                <TableCell className="capitalize">{transaction.transaction_type.replace("_", " ")}</TableCell>
                <TableCell className="text-right">UGX {transaction.amount.toLocaleString()}</TableCell>
                <TableCell>{transaction.description || "—"}</TableCell>
                <TableCell>
                  <Badge variant={
                    transaction.status === "approved" ? "default" :
                    transaction.status === "pending" ? "secondary" : "destructive"
                  }>
                    {transaction.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {transaction.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(
                            transaction.id,
                            transaction.account.id,
                            transaction.amount,
                            transaction.transaction_type
                          )}
                          title="Approve"
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(transaction.id)}
                          title="Reject"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {transaction.status === "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleGenerateReceipt(transaction)}
                        title="Generate Receipt"
                      >
                        <FileText className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    
                    {/* Delete button for all transactions - admin only */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Delete Transaction"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete transaction {transaction.tnx_id}? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(transaction.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
      </CardContent>
    </Card>
    </div>
  );
};

export default TransactionsManagement;
