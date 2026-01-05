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
    // Update loan status to disbursed
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
        description: "Loan disbursed successfully",
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
      }>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loans Management</CardTitle>
        <CardDescription>Review and manage loan applications - Loans require guarantor approval before admin approval</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Guarantor</TableHead>
              <TableHead>Guarantor Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Interest</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>{format(new Date(loan.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell>{loan.account.user.full_name}</TableCell>
                <TableCell>{loan.account.account_number}</TableCell>
                <TableCell>
                  {loan.guarantor_account ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {loan.guarantor_account.user.full_name}
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
                <TableCell>
                  {getGuarantorStatusBadge(loan.guarantor_status)}
                  {!loan.guarantor_account_id && "—"}
                </TableCell>
                <TableCell className="text-right">UGX {loan.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">{loan.interest_rate}%</TableCell>
                <TableCell className="text-right">UGX {loan.total_amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">UGX {loan.outstanding_balance.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={
                    loan.status === "disbursed" || loan.status === "completed" ? "default" :
                    loan.status === "approved" ? "secondary" :
                    loan.status === "pending" ? "outline" : "destructive"
                  }>
                    {loan.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {loan.status === "pending" && (
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(loan)}
                              disabled={loan.guarantor_account_id !== null && loan.guarantor_status !== "approved"}
                            >
                              <Check className="h-4 w-4 text-green-600" />
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
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                  {loan.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={() => handleDisburse(loan.id, loan.account.id, loan.amount)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Disburse
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LoansManagement;
