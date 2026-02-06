import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Receipt } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

interface WelfareEntry {
  id: string;
  amount: number;
  week_date: string;
  description: string;
  created_at: string;
  account: {
    account_number: string;
    user: {
      full_name: string;
    };
  };
}

interface Account {
  id: string;
  account_number: string;
  balance: number;
  total_savings: number;
  user: {
    full_name: string;
  };
}

const WelfareManagement = () => {
  const { toast } = useToast();
  const [welfareEntries, setWelfareEntries] = useState<WelfareEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [totalWelfare, setTotalWelfare] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Fetch welfare entries
    const { data: welfareData } = await supabase
      .from("welfare")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch all accounts
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, balance, total_savings, user_id");

    if (!accountsData || accountsData.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch profiles for all user_ids
    const userIds = [...new Set(accountsData.map(a => a.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Map accounts with user info
    const accountsWithUsers = accountsData.map(account => ({
      ...account,
      user: profilesMap.get(account.user_id) || { full_name: "Unknown" }
    }));

    setAccounts(accountsWithUsers as any);

    // Map welfare entries with account info
    if (welfareData) {
      const accountsMap = new Map(accountsWithUsers.map(a => [a.id, a]));
      const welfareWithAccounts = welfareData.map(entry => ({
        ...entry,
        account: accountsMap.get(entry.account_id) || { 
          account_number: "Unknown", 
          user: { full_name: "Unknown" } 
        }
      }));
      setWelfareEntries(welfareWithAccounts as any);
      const total = welfareData.reduce((sum, entry) => sum + Number(entry.amount), 0);
      setTotalWelfare(total);
    }
    
    setLoading(false);
  };

  const handleSingleWelfare = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProcessing(true);

    const formData = new FormData(e.currentTarget);
    const accountId = formData.get("accountId") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const description = formData.get("description") as string;
    const weekDate = formData.get("weekDate") as string;

    // Get current account balance
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      toast({
        title: "Error",
        description: "Account not found",
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    // Insert welfare entry
    const { error: welfareError } = await supabase
      .from("welfare")
      .insert({
        account_id: accountId,
        amount,
        description,
        week_date: weekDate,
      });

    if (welfareError) {
      toast({
        title: "Error",
        description: welfareError.message,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    // Deduct from account balance and total_savings immediately
    const newBalance = Math.max(0, account.balance - amount);
    const newTotalSavings = Math.max(0, account.total_savings - amount);

    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        balance: newBalance,
        total_savings: newTotalSavings,
      })
      .eq("id", accountId);

    if (updateError) {
      toast({
        title: "Warning",
        description: "Welfare recorded but balance update failed: " + updateError.message,
        variant: "destructive",
      });
    } else {
      // Create transaction record for tracking
      await supabase
        .from("transactions")
        .insert({
          account_id: accountId,
          transaction_type: "withdrawal",
          amount: amount,
          description: description || "Welfare fee deduction",
          balance_after: newBalance,
          status: "approved",
          approved_at: new Date().toISOString(),
        } as any);

      toast({
        title: "Success",
        description: `Welfare fee of UGX ${amount.toLocaleString()} recorded and deducted from account`,
      });
    }

    setDialogOpen(false);
    loadData();
    setProcessing(false);
  };

  const handleBulkWelfare = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProcessing(true);

    const formData = new FormData(e.currentTarget);
    const weeksCount = parseInt(formData.get("weeksCount") as string);
    const weeklyAmount = parseFloat(formData.get("weeklyAmount") as string);

    const today = new Date();
    const welfareEntries: any[] = [];
    const accountUpdates: { id: string; totalDeduction: number; currentBalance: number; currentSavings: number }[] = [];

    // For each account, create welfare entries for the past weeks
    for (const account of accounts) {
      const totalDeduction = weeksCount * weeklyAmount;
      
      accountUpdates.push({
        id: account.id,
        totalDeduction,
        currentBalance: account.balance,
        currentSavings: account.total_savings,
      });
      
      // Create one entry per week for each account
      for (let i = weeksCount; i >= 1; i--) {
        const weekDate = startOfWeek(subWeeks(today, i), { weekStartsOn: 6 }); // Saturday
        
        welfareEntries.push({
          account_id: account.id,
          amount: weeklyAmount,
          description: `Weekly welfare fee - Week ${weeksCount - i + 1}`,
          week_date: format(weekDate, "yyyy-MM-dd"),
        });
      }
    }

    // Insert all welfare entries
    const { error: welfareError } = await supabase
      .from("welfare")
      .insert(welfareEntries);

    if (welfareError) {
      toast({
        title: "Error",
        description: welfareError.message,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    // Update all account balances
    let successCount = 0;
    let errorCount = 0;

    for (const update of accountUpdates) {
      const newBalance = Math.max(0, update.currentBalance - update.totalDeduction);
      const newTotalSavings = Math.max(0, update.currentSavings - update.totalDeduction);

      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          balance: newBalance,
          total_savings: newTotalSavings,
        })
        .eq("id", update.id);

      if (updateError) {
        errorCount++;
      } else {
        // Create transaction record
        await supabase
          .from("transactions")
          .insert({
            account_id: update.id,
            transaction_type: "withdrawal",
            amount: update.totalDeduction,
            description: `Bulk welfare fee deduction (${weeksCount} weeks)`,
            balance_after: newBalance,
            status: "approved",
            approved_at: new Date().toISOString(),
          } as any);
        successCount++;
      }
    }

    toast({
      title: "Success",
      description: `Recorded ${weeksCount} weeks of welfare fees for ${successCount} accounts. UGX ${(weeklyAmount * weeksCount).toLocaleString()} deducted from each. ${errorCount > 0 ? `${errorCount} failed.` : ""}`,
    });
    setBulkDialogOpen(false);
    loadData();
    setProcessing(false);
  };

  const handleDeductFromSavings = async () => {
    setProcessing(true);

    // Get all welfare entries grouped by account and calculate total per account
    const { data: welfareByAccount } = await supabase
      .from("welfare")
      .select("account_id, amount");

    if (!welfareByAccount) {
      setProcessing(false);
      return;
    }

    // Group by account
    const accountTotals = welfareByAccount.reduce((acc: Record<string, number>, entry) => {
      acc[entry.account_id] = (acc[entry.account_id] || 0) + Number(entry.amount);
      return acc;
    }, {});

    // Update each account's balance and total_savings
    let success = 0;
    let errors = 0;

    for (const [accountId, totalWelfare] of Object.entries(accountTotals)) {
      const account = accounts.find(a => a.id === accountId);
      if (!account) continue;

      const newBalance = Math.max(0, account.balance - totalWelfare);
      const newTotalSavings = Math.max(0, account.total_savings - totalWelfare);

      const { error } = await supabase
        .from("accounts")
        .update({
          balance: newBalance,
          total_savings: newTotalSavings,
        })
        .eq("id", accountId);

      // Also create a transaction record
      await supabase
        .from("transactions")
        .insert({
          account_id: accountId,
          transaction_type: "withdrawal",
          amount: totalWelfare,
          description: "Welfare fee deduction",
          balance_after: newBalance,
          status: "approved",
          approved_at: new Date().toISOString(),
        } as any);

      if (error) {
        errors++;
      } else {
        success++;
      }
    }

    toast({
      title: "Deduction Complete",
      description: `Successfully deducted welfare from ${success} accounts. ${errors > 0 ? `${errors} failed.` : ""}`,
    });

    loadData();
    setProcessing(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Welfare Fee Management</CardTitle>
              <CardDescription>
                Manage weekly welfare fee deductions (UGX 2,000 per week)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Receipt className="mr-2 h-4 w-4" />
                    Bulk Record Past Weeks
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Past Weeks Welfare</DialogTitle>
                    <DialogDescription>
                      Record welfare fees for all members for past weeks
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleBulkWelfare} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="weeksCount">Number of Weeks</Label>
                      <Input
                        id="weeksCount"
                        name="weeksCount"
                        type="number"
                        defaultValue="9"
                        min="1"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weeklyAmount">Weekly Amount (UGX)</Label>
                      <Input
                        id="weeklyAmount"
                        name="weeklyAmount"
                        type="number"
                        defaultValue="2000"
                        required
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This will record {accounts.length} accounts × weeks × UGX amount in welfare fees
                    </p>
                    <Button type="submit" className="w-full" disabled={processing}>
                      {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Record Bulk Welfare
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Welfare Entry
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Welfare Entry</DialogTitle>
                    <DialogDescription>Record a welfare fee for a member</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSingleWelfare} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountId">Member Account</Label>
                      <Select name="accountId" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.user.full_name} - {account.account_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (UGX)</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        defaultValue="2000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weekDate">Week Date</Label>
                      <Input
                        id="weekDate"
                        name="weekDate"
                        type="date"
                        defaultValue={format(new Date(), "yyyy-MM-dd")}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        name="description"
                        defaultValue="Weekly welfare fee"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={processing}>
                      {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Entry
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Welfare Collected</p>
              <p className="text-2xl font-bold">UGX {totalWelfare.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Welfare fees are automatically deducted from member accounts when recorded
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {welfareEntries.slice(0, 50).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{format(new Date(entry.week_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{entry.account.user.full_name}</TableCell>
                  <TableCell>{entry.account.account_number}</TableCell>
                  <TableCell className="text-right">UGX {entry.amount.toLocaleString()}</TableCell>
                  <TableCell>{entry.description || "—"}</TableCell>
                </TableRow>
              ))}
              {welfareEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No welfare entries recorded yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default WelfareManagement;