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
import { UserPlus, Loader2, Link, Unlink, Plus, ArrowUpRight } from "lucide-react";
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
  const [subAccountDialogOpen, setSubAccountDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [parentAccountId, setParentAccountId] = useState<string>("");
  const [selectedParentForSubAccount, setSelectedParentForSubAccount] = useState<Account | null>(null);

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

    // Fetch sub-account profiles for sub-accounts
    const subAccountIds = accountsData.filter(a => a.account_type === 'sub').map(a => a.id);
    let subProfilesMap = new Map();
    
    if (subAccountIds.length > 0) {
      const { data: subProfilesData } = await supabase
        .from("sub_account_profiles")
        .select("account_id, full_name, phone_number")
        .in("account_id", subAccountIds);
      
      subProfilesMap = new Map(subProfilesData?.map(p => [p.account_id, p]) || []);
    }

    const accountsWithUsers = accountsData.map(account => {
      // For sub-accounts, use sub_account_profiles; for main accounts, use profiles
      if (account.account_type === 'sub' && subProfilesMap.has(account.id)) {
        const subProfile = subProfilesMap.get(account.id);
        return {
          ...account,
          user: { 
            full_name: subProfile.full_name, 
            email: "", 
            phone_number: subProfile.phone_number || "" 
          }
        };
      }
      return {
        ...account,
        user: profilesMap.get(account.user_id) || { full_name: "Unknown", email: "", phone_number: "" }
      };
    });

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
        description: "Account promoted to independent member account",
      });
      loadAccounts();
    }
  };

  const openSubAccountDialog = (parent: Account) => {
    setSelectedParentForSubAccount(parent);
    setSubAccountDialogOpen(true);
  };

  const handleCreateSubAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedParentForSubAccount) return;
    
    setCreating(true);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const phoneNumber = formData.get("phoneNumber") as string;

    // Create sub-account without separate auth user
    const { data, error } = await supabase.functions.invoke('create-member', {
      body: { 
        fullName, 
        phoneNumber,
        parentAccountId: selectedParentForSubAccount.id,
        isSubAccount: true
      }
    });

    if (error || data?.error) {
      toast({
        title: "Error",
        description: error?.message || data?.error || "Failed to create sub-account",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Sub-account created under ${selectedParentForSubAccount.user.full_name}'s account. Accessible within their account.`,
      });
      setSubAccountDialogOpen(false);
      loadAccounts();
    }

    setCreating(false);
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
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg md:text-xl">Members & Accounts</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-0.5">Manage all member accounts</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto shrink-0">
                <UserPlus className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span>Add Member</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Create New Member</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">Add a new member to the SACCO</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateMember} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="fullName" className="text-xs sm:text-sm">Full Name</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-xs sm:text-sm">Email (optional)</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="phoneNumber" className="text-xs sm:text-sm">Phone Number</Label>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" placeholder="+256 700 000000" />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password" className="text-xs sm:text-sm">Temporary Password</Label>
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
      <CardContent className="p-0 sm:p-4 md:p-6 pt-0">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="whitespace-nowrap">Account #</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Parent</TableHead>
                <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                <TableHead className="hidden md:table-cell text-right">Savings</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="truncate max-w-[100px] sm:max-w-none">{account.user.full_name}</span>
                      <span className="text-[10px] sm:hidden text-muted-foreground">{account.account_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="truncate max-w-[120px] block">{account.user.email || "—"}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{account.user.phone_number || "—"}</TableCell>
                  <TableCell className="font-mono text-[10px] sm:text-xs">{account.account_number}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={account.account_type === "main" ? "default" : "secondary"} className="text-[9px] sm:text-[10px]">
                      {account.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="truncate max-w-[100px] block text-xs">
                      {getParentAccountName(account.parent_account_id) || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className="text-[10px] sm:text-xs">UGX {account.balance.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right whitespace-nowrap">
                    <span className="text-xs">UGX {account.total_savings.toLocaleString()}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      {account.account_type === "main" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSubAccountDialog(account)}
                            title="Create sub-account"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openMergeDialog(account)}
                            title="Merge as sub-account"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </>
                      )}
                      {account.account_type === "sub" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnmergeAccount(account.id)}
                          title="Promote to independent"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

      {/* Create Sub-Account Dialog */}
      <Dialog open={subAccountDialogOpen} onOpenChange={setSubAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sub-Account</DialogTitle>
            <DialogDescription>
              Create a new sub-account under {selectedParentForSubAccount?.user.full_name}'s account.
              This sub-account shares the same login credentials and is accessible within the parent account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subFullName">Full Name</Label>
              <Input id="subFullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subPhoneNumber">Phone Number (optional)</Label>
              <Input id="subPhoneNumber" name="phoneNumber" type="tel" placeholder="+256 700 000000" />
            </div>
            <p className="text-sm text-muted-foreground">
              No separate login required. The member can manage this sub-account from their dashboard.
            </p>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Sub-Account
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MembersManagement;