import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface LoanRequest {
  id: string;
  amount: number;
  total_amount: number;
  created_at: string;
  guarantor_status: string;
  accounts: {
    account_number: string;
    user_id: string;
  };
  applicant_name?: string;
  applicant_email?: string;
}

const GuarantorRequests = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Get current user's main account and sub-accounts
      const { data: myAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id);

      if (myAccounts && myAccounts.length > 0) {
        const myAccountIds = myAccounts.map(a => a.id);
        
        // Get loan requests where any of my accounts is the guarantor
        const { data: loans, error } = await (supabase
          .from("loans")
          .select(`id, amount, total_amount, created_at, account_id`) as any)
          .in("guarantor_account_id", myAccountIds)
          .eq("guarantor_status", "pending");

        if (!error && loans) {
          // Fetch account info and profiles for each loan applicant
          const loansWithProfiles = await Promise.all(
            (loans as any[]).map(async (loan: any) => {
              const { data: account } = await supabase
                .from("accounts")
                .select("account_number, user_id, account_type")
                .eq("id", loan.account_id)
                .single();

              let applicantName = "Unknown";
              let applicantEmail = "";

              if (account) {
                // Check if it's a sub-account - get name from sub_account_profiles
                if (account.account_type === 'sub') {
                  const { data: subProfile } = await supabase
                    .from("sub_account_profiles")
                    .select("full_name")
                    .eq("account_id", loan.account_id)
                    .single();
                  
                  if (subProfile) {
                    applicantName = subProfile.full_name + " (Sub-account)";
                  }
                } else {
                  // Main account - get from profiles
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name, email")
                    .eq("id", account.user_id)
                    .single();

                  if (profile) {
                    applicantName = profile.full_name;
                    applicantEmail = profile.email;
                  }
                }
              }

              return {
                ...loan,
                accounts: account || { account_number: "N/A", user_id: "" },
                applicant_name: applicantName,
                applicant_email: applicantEmail,
              };
            })
          );

          setRequests(loansWithProfiles as LoanRequest[]);
        }
      }
    }
    
    setLoading(false);
  };

  const handleApprove = async (loanId: string) => {
    setProcessing(loanId);

    const { error } = await supabase
      .from("loans")
      .update({ guarantor_status: "approved" } as any)
      .eq("id", loanId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Approved",
        description: "You have approved the loan guarantee request",
      });
      loadRequests();
    }

    setProcessing(null);
  };

  const handleReject = async (loanId: string) => {
    setProcessing(loanId);

    const { error } = await supabase
      .from("loans")
      .update({ guarantor_status: "rejected" } as any)
      .eq("id", loanId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Rejected",
        description: "You have rejected the loan guarantee request",
      });
      loadRequests();
    }

    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guarantor Requests</CardTitle>
        <CardDescription>
          Review and approve/reject loan guarantee requests from other members
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pending guarantor requests
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Loan Amount</TableHead>
                <TableHead>Total (with interest)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    {format(new Date(request.created_at), "PP")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.applicant_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.applicant_email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{request.accounts.account_number}</TableCell>
                  <TableCell>UGX {request.amount.toLocaleString()}</TableCell>
                  <TableCell>UGX {request.total_amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={processing === request.id}
                      >
                        {processing === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(request.id)}
                        disabled={processing === request.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default GuarantorRequests;
