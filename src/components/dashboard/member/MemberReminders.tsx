import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Reminder {
  id: string;
  reminder_type: string;
  title: string;
  message: string;
  due_date: string | null;
  is_read: boolean;
  created_at: string;
}

const MemberReminders = () => {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

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
        .single();

      if (account) {
        const { data } = await supabase
          .from("reminders")
          .select("*")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false });

        if (data) {
          setReminders(data);
        }
      }
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("reminders")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      loadReminders();
    }
  };

  const unreadCount = reminders.filter((r) => !r.is_read).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          My Reminders
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Alerts and reminders from KINONI SACCO</CardDescription>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No reminders yet</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`p-4 rounded-lg border ${
                  reminder.is_read ? "bg-muted/30" : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="capitalize text-xs">
                        {reminder.reminder_type.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reminder.created_at), "MMM dd, yyyy")}
                      </span>
                      {reminder.due_date && (
                        <span className="text-xs text-destructive">
                          Due: {format(new Date(reminder.due_date), "MMM dd")}
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium mb-1">{reminder.title}</h4>
                    <p className="text-sm text-muted-foreground">{reminder.message}</p>
                  </div>
                  {!reminder.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(reminder.id)}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MemberReminders;
