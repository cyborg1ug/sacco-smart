import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Bell, Wallet, CreditCard, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Reminder {
  id: string;
  reminder_type: string;
  title: string;
  message: string;
  due_date: string | null;
  is_read: boolean;
  created_at: string;
}

const NotificationsPopover = () => {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadReminders();
    }
  }, [open]);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("account_type", "main")
        .maybeSingle();

      if (account) {
        const { data } = await supabase
          .from("reminders")
          .select("*")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (data) {
          setReminders(data);
        }
      }
    }
    
    setLoading(false);
  };

  const markAsRead = async (reminderId: string) => {
    const { error } = await supabase
      .from("reminders")
      .update({ is_read: true })
      .eq("id", reminderId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark as read",
        variant: "destructive",
      });
    } else {
      loadReminders();
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = reminders.filter(r => !r.is_read).map(r => r.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("reminders")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    } else {
      loadReminders();
      toast({
        title: "Done",
        description: "All notifications marked as read",
      });
    }
  };

  const unreadCount = reminders.filter(r => !r.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "savings":
        return <Wallet className="h-4 w-4 text-green-500" />;
      case "loan_repayment":
        return <CreditCard className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {reminders.map((reminder) => (
                <div 
                  key={reminder.id} 
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !reminder.is_read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => !reminder.is_read && markAsRead(reminder.id)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getIcon(reminder.reminder_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm truncate">{reminder.title}</p>
                        {!reminder.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {reminder.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{format(new Date(reminder.created_at), "MMM dd, yyyy")}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {reminder.reminder_type.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;