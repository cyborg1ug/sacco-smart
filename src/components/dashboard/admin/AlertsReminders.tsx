import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Plus, Loader2, Send, Trash2, Mail, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Reminder {
  id: string;
  reminder_type: string;
  title: string;
  message: string;
  due_date: string | null;
  is_read: boolean;
  is_email_sent: boolean;
  created_at: string;
  account: {
    account_number: string;
    user: {
      full_name: string;
      email: string;
    };
  };
}

const AlertsReminders = () => {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [creatingBulk, setCreatingBulk] = useState(false);

  useEffect(() => {
    loadReminders();
    loadMembers();
  }, []);

  const loadReminders = async () => {
    const { data } = await supabase
      .from("reminders")
      .select(`
        *,
        account:accounts (
          account_number,
          user:profiles (
            full_name,
            email
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (data) {
      setReminders(data as any);
    }
    setLoading(false);
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from("accounts")
      .select(`
        id,
        account_number,
        balance,
        user:profiles (
          full_name,
          email
        )
      `);

    if (data) {
      setMembers(data);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const accountId = formData.get("accountId") as string;
    const reminderType = formData.get("reminderType") as string;
    const title = formData.get("title") as string;
    const message = formData.get("message") as string;
    const dueDate = formData.get("dueDate") as string;

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("reminders")
      .insert({
        account_id: accountId,
        reminder_type: reminderType,
        title,
        message,
        due_date: dueDate || null,
        created_by: user?.id,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Reminder created successfully",
      });
      setDialogOpen(false);
      loadReminders();
    }
  };

  const handleSendEmail = async (reminder: Reminder) => {
    setSendingEmail(reminder.id);
    
    try {
      const { error } = await supabase.functions.invoke("send-reminder-email", {
        body: {
          to: reminder.account.user.email,
          name: reminder.account.user.full_name,
          title: reminder.title,
          message: reminder.message,
          reminderType: reminder.reminder_type,
          dueDate: reminder.due_date,
        },
      });

      if (error) throw error;

      await supabase
        .from("reminders")
        .update({ is_email_sent: true })
        .eq("id", reminder.id);

      toast({
        title: "Success",
        description: `Email sent to ${reminder.account.user.email}`,
      });
      loadReminders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    }
    
    setSendingEmail(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Reminder deleted",
      });
      loadReminders();
    }
  };

  const handleCreateBulkSavingsReminders = async () => {
    setCreatingBulk(true);
    const { data: { user } } = await supabase.auth.getUser();

    const remindersToCreate = members.map((member) => ({
      account_id: member.id,
      reminder_type: "savings",
      title: "Weekly Savings Reminder",
      message: `Dear ${member.user.full_name}, this is a friendly reminder to make your weekly savings contribution. Consistent savings help you build financial security and maintain loan eligibility. Current balance: UGX ${Number(member.balance).toLocaleString()}.`,
      created_by: user?.id,
    }));

    const { error } = await supabase
      .from("reminders")
      .insert(remindersToCreate);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Created ${members.length} savings reminders`,
      });
      loadReminders();
    }
    setCreatingBulk(false);
  };

  const handleCreateLoanReminders = async () => {
    setCreatingBulk(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: activeLoans } = await supabase
      .from("loans")
      .select(`
        *,
        account:accounts (
          id,
          user:profiles (
            full_name
          )
        )
      `)
      .eq("status", "disbursed");

    if (activeLoans && activeLoans.length > 0) {
      const remindersToCreate = activeLoans.map((loan: any) => ({
        account_id: loan.account.id,
        reminder_type: "loan_repayment",
        title: "Loan Repayment Reminder",
        message: `Dear ${loan.account.user.full_name}, this is a reminder about your outstanding loan. Outstanding balance: UGX ${Number(loan.outstanding_balance).toLocaleString()}. Please ensure timely repayment to maintain a good standing.`,
        created_by: user?.id,
      }));

      const { error } = await supabase
        .from("reminders")
        .insert(remindersToCreate);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Created ${activeLoans.length} loan repayment reminders`,
        });
        loadReminders();
      }
    } else {
      toast({
        title: "Info",
        description: "No active loans found",
      });
    }
    setCreatingBulk(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alerts & Reminders
            </CardTitle>
            <CardDescription>Manage member reminders and notifications</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCreateBulkSavingsReminders} disabled={creatingBulk}>
              {creatingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Savings Reminders
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateLoanReminders} disabled={creatingBulk}>
              {creatingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Loan Reminders
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Reminder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Reminder</DialogTitle>
                  <DialogDescription>Send an alert or reminder to a member</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateReminder} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Member</Label>
                    <Select name="accountId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.user.full_name} - {member.account_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reminder Type</Label>
                    <Select name="reminderType" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings Reminder</SelectItem>
                        <SelectItem value="loan_repayment">Loan Repayment</SelectItem>
                        <SelectItem value="general">General Notice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="title" required placeholder="Reminder title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea name="message" required placeholder="Reminder message" rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date (Optional)</Label>
                    <Input name="dueDate" type="date" />
                  </div>
                  <Button type="submit" className="w-full">
                    <Send className="mr-2 h-4 w-4" />
                    Create Reminder
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reminders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No reminders yet
                </TableCell>
              </TableRow>
            ) : (
              reminders.map((reminder) => (
                <TableRow key={reminder.id}>
                  <TableCell>{format(new Date(reminder.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{reminder.account.user.full_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {reminder.reminder_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{reminder.title}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {reminder.is_read && <Badge variant="secondary">Read</Badge>}
                      {reminder.is_email_sent && <Badge>Emailed</Badge>}
                      {!reminder.is_read && !reminder.is_email_sent && (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendEmail(reminder)}
                        disabled={sendingEmail === reminder.id || reminder.is_email_sent}
                        title="Send email"
                      >
                        {sendingEmail === reminder.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(reminder.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AlertsReminders;
