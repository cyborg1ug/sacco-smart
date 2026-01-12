import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Send, Loader2, Users } from "lucide-react";
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
        <div className="flex gap-1">
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

  const renderMobileCard = (loan: Loan) => {
    const statusInfo = getLoanStatusBadge(loan);
    
    return (
      <MobileCard
        key={loan.id}
        fields={[
          { label: "Member", value: loan.account.user.full_name },
          { label: "Amount", value: `UGX ${loan.amount.toLocaleString()}` },
          { label: "Outstanding", value: `UGX ${loan.outstanding_balance.toLocaleString()}` },
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
            <TableHead className="hidden md:table-cell text-right">Interest</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Total</TableHead>
            <TableHead className="text-right whitespace-nowrap">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => {
            const statusInfo = getLoanStatusBadge(loan);
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
                  {loan.interest_rate}%
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
  );
};

export default LoansManagement;
