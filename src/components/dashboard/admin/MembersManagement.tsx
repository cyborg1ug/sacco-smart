import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2 } from "lucide-react";

interface Member {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  account_number: string;
  balance: number;
  total_savings: number;
}

const MembersManagement = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        phone_number,
        accounts (
          account_number,
          balance,
          total_savings
        )
      `);

    if (data) {
      const formattedMembers = data.map((member: any) => ({
        id: member.id,
        email: member.email,
        full_name: member.full_name,
        phone_number: member.phone_number,
        account_number: member.accounts?.[0]?.account_number || "N/A",
        balance: member.accounts?.[0]?.balance || 0,
        total_savings: member.accounts?.[0]?.total_savings || 0,
      }));
      setMembers(formattedMembers);
    }
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
      loadMembers();
    }

    setCreating(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Members Management</CardTitle>
            <CardDescription>View and manage all member accounts</CardDescription>
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
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" />
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
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Total Savings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.full_name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>{member.phone_number || "N/A"}</TableCell>
                <TableCell>{member.account_number}</TableCell>
                <TableCell className="text-right">UGX {member.balance.toLocaleString()}</TableCell>
                <TableCell className="text-right">UGX {member.total_savings.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MembersManagement;
