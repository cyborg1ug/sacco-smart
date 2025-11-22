import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface RecentActivity {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
}

const AccountOverview = () => {
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (account) {
        const { data: transactions } = await supabase
          .from("transactions")
          .select("id, transaction_type, amount, status, created_at")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (transactions) {
          setRecentActivity(transactions);
        }
      }
    }
    
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest transactions and updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{activity.transaction_type.replace("_", " ")}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(activity.created_at), "MMM dd, yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">UGX {activity.amount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground capitalize">{activity.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountOverview;
