import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Send, Loader2, Users, UserPlus, CheckCircle } from "lucide-react";
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
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedGuarantor, setSelectedGuarantor] = useState("");
  const [guarantorCandidates, setGuarantorCandidates] = useState<any[]>([]);
  const [loadingGuarantors, setLoadingGuarantors] = useState(false);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    const { data } = await supabase
      .from("loans")
      .select(`
        *,
        account:accounts!loans_account_id_fkey (
          id,
          account_number,
          user:profiles!accounts_user_id_fkey (
            full_name
          )
        ),
        guarantor_account:accounts!loans_guarantor_account_id_fkey (
          account_number,
          user:profiles!accounts_user_id_fkey (
            full_name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (data) {
      setLoans(data as any);
    }
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

    // Get loan applicant's savings
    const loanAccount = accountsData.find(a => a.id === loanAccountId);
    const minSavings = loanAccount?.total_savings || 0;

    // Filter candidates (must have savings >= applicant's savings, exclude applicant)
    const eligibleAccounts = accountsData.filter(a => 
      a.id !== loanAccountId && a.total_savings >= minSavings
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

    const { error } = await supabase
      .from("loans")
      .update({
        status: "approved",
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
        description: "Loan approved successfully",
      });
      loadLoans();
      onUpdate();
    }
  };

  const handleReject = async (loanId: string) => {
    const { data: { user } } = await supabase.auth.getUser();

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
      loadLoans();
      onUpdate();
    }
  };

  const handleDisburse = async (loanId: string, accountId: string, amount: number) => {
    // Update loan status to active (was disbursed, now active until repaid)
    const { error: loanError } = await supabase
      .from("loans")
      .update({
        status: "active",
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
    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", accountId)
      .single();

    if (!account) return;

    const newBalance = account.balance + amount;

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
        description: "Loan disbursed and marked as active",
      });
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
    
    if (loan.status === "approved") {
      return (
        <Button
          size="sm"
          onClick={() => handleDisburse(loan.id, loan.account.id, loan.amount)}
          className="h-7 sm:h-8 text-[10px] sm:text-xs"
        >
          <Send className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" />
          Disburse
        </Button>
      );
    }
    
    return null;
  };

  const calculateMonthlyPayment = (loan: Loan) => {
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
          {loans.map((loan) => {
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
    <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg md:text-xl">Loans Management</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Disbursed loans stay active until fully repaid
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
        <MobileCardList
          items={loans}
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
  );
};

export default LoansManagement;
