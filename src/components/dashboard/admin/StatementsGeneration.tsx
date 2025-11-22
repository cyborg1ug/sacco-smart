import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";

const StatementsGeneration = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");

  const loadMembers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        accounts (
          id,
          account_number
        )
      `);

    if (data) {
      setMembers(data);
    }
  };

  const generateMemberStatement = async () => {
    if (!selectedMember) {
      toast({
        title: "Error",
        description: "Please select a member",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Get member details
    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        full_name,
        email,
        accounts!inner (
          id,
          account_number,
          balance,
          total_savings
        )
      `)
      .eq("id", selectedMember)
      .single() as { data: any };

    if (!profile) {
      toast({
        title: "Error",
        description: "Member not found",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Get transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", profile.accounts[0].id)
      .order("created_at", { ascending: false });

    // Get loans
    const { data: loans } = await supabase
      .from("loans")
      .select("*")
      .eq("account_id", profile.accounts[0].id);

    // Generate statement text
    let statement = `SACCO MEMBER STATEMENT\n`;
    statement += `Generated: ${format(new Date(), "MMMM dd, yyyy")}\n\n`;
    statement += `Member: ${profile.full_name}\n`;
    statement += `Email: ${profile.email}\n`;
    statement += `Account: ${profile.accounts[0].account_number}\n\n`;
    statement += `Current Balance: UGX ${profile.accounts[0].balance.toLocaleString()}\n`;
    statement += `Total Savings: UGX ${profile.accounts[0].total_savings.toLocaleString()}\n\n`;

    statement += `TRANSACTIONS\n`;
    statement += `${"=".repeat(80)}\n`;
    transactions?.forEach((t) => {
      statement += `${format(new Date(t.created_at), "MMM dd, yyyy")} | `;
      statement += `${t.transaction_type.toUpperCase().padEnd(20)} | `;
      statement += `UGX ${t.amount.toLocaleString().padStart(15)} | `;
      statement += `${t.status}\n`;
    });

    statement += `\nLOANS\n`;
    statement += `${"=".repeat(80)}\n`;
    loans?.forEach((l) => {
      statement += `Amount: UGX ${l.amount.toLocaleString()} | `;
      statement += `Outstanding: UGX ${l.outstanding_balance.toLocaleString()} | `;
      statement += `Status: ${l.status}\n`;
    });

    // Download as text file
    const blob = new Blob([statement], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${profile.accounts[0].account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Statement generated successfully",
    });

    setLoading(false);
  };

  const generateGroupStatement = async () => {
    setLoading(true);

    // Get all accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("balance, total_savings");

    // Get all transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    // Get all loans
    const { data: loans } = await supabase
      .from("loans")
      .select("*");

    const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    const totalSavings = accounts?.reduce((sum, acc) => sum + Number(acc.total_savings), 0) || 0;
    const totalLoans = loans?.reduce((sum, loan) => sum + Number(loan.outstanding_balance), 0) || 0;

    let statement = `SACCO GROUP STATEMENT\n`;
    statement += `Generated: ${format(new Date(), "MMMM dd, yyyy")}\n\n`;
    statement += `Total Members: ${accounts?.length || 0}\n`;
    statement += `Total Balance: UGX ${totalBalance.toLocaleString()}\n`;
    statement += `Total Savings: UGX ${totalSavings.toLocaleString()}\n`;
    statement += `Total Outstanding Loans: UGX ${totalLoans.toLocaleString()}\n\n`;

    statement += `RECENT TRANSACTIONS\n`;
    statement += `${"=".repeat(80)}\n`;
    transactions?.slice(0, 50).forEach((t) => {
      statement += `${format(new Date(t.created_at), "MMM dd, yyyy")} | `;
      statement += `${t.transaction_type.toUpperCase().padEnd(20)} | `;
      statement += `UGX ${t.amount.toLocaleString().padStart(15)} | `;
      statement += `${t.status}\n`;
    });

    const blob = new Blob([statement], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group_statement_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Group statement generated successfully",
    });

    setLoading(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Member Statement</CardTitle>
          <CardDescription>Generate statement for a specific member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Member</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember} onOpenChange={(open) => {
              if (open && members.length === 0) {
                loadMembers();
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name} - {member.accounts?.[0]?.account_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generateMemberStatement} className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileDown className="mr-2 h-4 w-4" />
            Generate Statement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Group Statement</CardTitle>
          <CardDescription>Generate consolidated statement for all members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will generate a comprehensive statement including all member accounts,
            transactions, and loans.
          </p>
          <Button onClick={generateGroupStatement} className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileDown className="mr-2 h-4 w-4" />
            Generate Group Statement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatementsGeneration;
