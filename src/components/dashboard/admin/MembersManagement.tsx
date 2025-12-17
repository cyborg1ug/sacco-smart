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
import { UserPlus, Loader2, Link, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Account {
  id: string;
  account_number: string;
  balance: number;
  total_savings: number;
  account_type: string;
  parent_account_id: string | null;
  user_id: string;
  user: {
    full_name: string;
    email: string;
    phone_number: string;
  };
}

const MembersManagement = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [parentAccountId, setParentAccountId] = useState<string>("");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    // First fetch accounts
    const { data: accountsData, error: accountsError } = await supabase
      .from("accounts")
      .select("*")
      .order("account_number");

    if (accountsError) {
      console.error("Error loading accounts:", accountsError);
      setLoading(false);
      return;
    }

    if (!accountsData || accountsData.length === 0) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    // Get unique user_ids and fetch profiles
    const userIds = [...new Set(accountsData.map(a => a.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone_number")
      .in("id", userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    const accountsWithUsers = accountsData.map(account => ({
      ...account,
      user: profilesMap.get(account.user_id) || { full_name: "Unknown", email: "", phone_number: "" }
    }));

    setAccounts(accountsWithUsers as any);
    setLoading(false);
  };

  const handleCreateMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const phoneNumber = formData.get("phoneNumber") as string;

    const { data, error } = await supabase.functions.invoke('create-member', {
      body: { email, password, fullName, phoneNumber }
    });

    if (error || data?.error) {
      toast({
        title: "Error",
        description: error?.message || data?.error || "Failed to create member",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Member account created successfully",
      });
      setDialogOpen(false);
      loadAccounts();
    }

    setCreating(false);
  };

  const openMergeDialog = (account: Account) => {
    setSelectedAccount(account);
    setParentAccountId("");
    setMergeDialogOpen(true);
  };

  const handleMergeAccounts = async () => {
    if (!selectedAccount || !parentAccountId) return;

    if (selectedAccount.id === parentAccountId) {
      toast({
        title: "Error",
        description: "Cannot set an account as its own parent",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("accounts")
      .update({ 
        parent_account_id: parentAccountId,
        account_type: "sub"
      })
      .eq("id", selectedAccount.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Account merged successfully as sub-account",
      });
      setMergeDialogOpen(false);
      loadAccounts();
    }
  };

  const handleUnmergeAccount = async (accountId: string) => {
    const { error } = await supabase
      .from("accounts")
      .update({ 
        parent_account_id: null,
        account_type: "main"
      })
      .eq("id", accountId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Account unmerged successfully",
      });
      loadAccounts();
    }
  };

  const getParentAccountName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = accounts.find(a => a.id === parentId);
    return parent ? `${parent.user.full_name} - ${parent.account_number}` : null;
  };

  const mainAccounts = accounts.filter(a => a.account_type === "main");

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Members & Accounts Management</CardTitle>
            <CardDescription>View and manage all member accounts with merging capability</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Member Account</DialogTitle>
                <DialogDescription>Add a new member to the SACCO</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional for phone users)</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" placeholder="+256 700 000000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Member
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Parent Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Total Savings</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.user.full_name}</TableCell>
                <TableCell>{account.user.email || "—"}</TableCell>
                <TableCell>{account.user.phone_number || "—"}</TableCell>
                <TableCell>{account.account_number}</TableCell>
                <TableCell>
                  <Badge variant={account.account_type === "main" ? "default" : "secondary"}>
                    {account.account_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {getParentAccountName(account.parent_account_id) || "—"}
                </TableCell>
                <TableCell className="text-right">UGX {account.balance.toLocaleString()}</TableCell>
                <TableCell className="text-right">UGX {account.total_savings.toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {account.account_type === "main" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMergeDialog(account)}
                        title="Merge as sub-account"
                      >
                        <Link className="h-4 w-4" />
                      </Button>
                    )}
                    {account.account_type === "sub" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnmergeAccount(account.id)}
                        title="Unmerge account"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Account</DialogTitle>
            <DialogDescription>
              Set this account as a sub-account of another main account.
              {selectedAccount && (
                <p className="mt-2 font-medium">
                  Merging: {selectedAccount.user.full_name} - {selectedAccount.account_number}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Parent (Main) Account</Label>
              <Select value={parentAccountId} onValueChange={setParentAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select main account" />
                </SelectTrigger>
                <SelectContent>
                  {mainAccounts
                    .filter(a => a.id !== selectedAccount?.id)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.user.full_name} - {account.account_number}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMergeDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleMergeAccounts} disabled={!parentAccountId} className="flex-1">
                Merge Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MembersManagement;