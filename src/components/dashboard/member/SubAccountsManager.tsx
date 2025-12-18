import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Users, Wallet, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubAccount {
  id: string;
  account_number: string;
  balance: number;
  total_savings: number;
  profile: {
    full_name: string;
    phone_number: string | null;
    national_id: string | null;
    occupation: string | null;
    address: string | null;
  } | null;
}

interface SubAccountsManagerProps {
  parentAccountId: string;
}

const SubAccountsManager = ({ parentAccountId }: SubAccountsManagerProps) => {
  const { toast } = useToast();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<SubAccount | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    national_id: "",
    occupation: "",
    address: "",
  });

  useEffect(() => {
    loadSubAccounts();
  }, [parentAccountId]);

  const loadSubAccounts = async () => {
    setLoading(true);
    
    // Fetch sub-accounts
    const { data: accountsData, error: accountsError } = await supabase
      .from("accounts")
      .select("id, account_number, balance, total_savings")
      .eq("parent_account_id", parentAccountId)
      .eq("account_type", "sub");

    if (accountsError) {
      console.error("Error loading sub-accounts:", accountsError);
      setLoading(false);
      return;
    }

    if (!accountsData || accountsData.length === 0) {
      setSubAccounts([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for sub-accounts
    const accountIds = accountsData.map(a => a.id);
    const { data: profilesData } = await supabase
      .from("sub_account_profiles")
      .select("account_id, full_name, phone_number, national_id, occupation, address")
      .in("account_id", accountIds);

    const profilesMap = new Map(profilesData?.map(p => [p.account_id, p]) || []);

    const subAccountsWithProfiles = accountsData.map(account => ({
      ...account,
      profile: profilesMap.get(account.id) || null
    }));

    setSubAccounts(subAccountsWithProfiles);
    setLoading(false);
  };

  const handleEditProfile = (account: SubAccount) => {
    setSelectedAccount(account);
    setFormData({
      full_name: account.profile?.full_name || "",
      phone_number: account.profile?.phone_number || "",
      national_id: account.profile?.national_id || "",
      occupation: account.profile?.occupation || "",
      address: account.profile?.address || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedAccount) return;
    setSaving(true);

    const { error } = await supabase
      .from("sub_account_profiles")
      .update({
        full_name: formData.full_name,
        phone_number: formData.phone_number || null,
        national_id: formData.national_id || null,
        occupation: formData.occupation || null,
        address: formData.address || null,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", selectedAccount.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Sub-account profile updated successfully",
      });
      setEditDialogOpen(false);
      loadSubAccounts();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (subAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sub-Accounts
          </CardTitle>
          <CardDescription>No sub-accounts linked to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact an administrator to create sub-accounts for your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Sub-Accounts ({subAccounts.length})
        </CardTitle>
        <CardDescription>Manage profiles for your linked sub-accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={subAccounts[0]?.id} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {subAccounts.map((account) => (
              <TabsTrigger key={account.id} value={account.id}>
                {account.profile?.full_name || account.account_number}
              </TabsTrigger>
            ))}
          </TabsList>

          {subAccounts.map((account) => (
            <TabsContent key={account.id} value={account.id} className="space-y-4">
              {/* Account Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Account Number</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{account.account_number}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Balance</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">UGX {account.balance.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">UGX {account.total_savings.toLocaleString()}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Profile Info */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">Profile Information</CardTitle>
                      <CardDescription>Sub-account holder details</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEditProfile(account)}>
                      Edit Profile
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground text-xs">Full Name</Label>
                      <p className="font-medium">{account.profile?.full_name || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone Number</Label>
                      <p className="font-medium">{account.profile?.phone_number || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">National ID</Label>
                      <p className="font-medium">{account.profile?.national_id || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Occupation</Label>
                      <p className="font-medium">{account.profile?.occupation || "—"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground text-xs">Address</Label>
                      <p className="font-medium">{account.profile?.address || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-Account Profile</DialogTitle>
            <DialogDescription>
              Update profile information for {selectedAccount?.account_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub_full_name">Full Name</Label>
              <Input
                id="sub_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub_phone_number">Phone Number</Label>
              <Input
                id="sub_phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="+256 700 000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub_national_id">National ID</Label>
              <Input
                id="sub_national_id"
                value={formData.national_id}
                onChange={(e) => setFormData(prev => ({ ...prev, national_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub_occupation">Occupation</Label>
              <Input
                id="sub_occupation"
                value={formData.occupation}
                onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub_address">Address</Label>
              <Input
                id="sub_address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <Button onClick={handleSaveProfile} className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SubAccountsManager;