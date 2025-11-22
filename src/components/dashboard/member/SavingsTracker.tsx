import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface SavingsRecord {
  id: string;
  amount: number;
  week_start: string;
  week_end: string;
  created_at: string;
}

const SavingsTracker = () => {
  const [savings, setSavings] = useState<SavingsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibilityProgress, setEligibilityProgress] = useState(0);

  useEffect(() => {
    loadSavings();
  }, []);

  const loadSavings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (account) {
        const { data } = await supabase
          .from("savings")
          .select("*")
          .eq("account_id", account.id)
          .order("week_start", { ascending: false });

        if (data) {
          setSavings(data);
          
          // Calculate eligibility progress
          const recentSavings = data
            .filter((s) => new Date(s.week_start) >= new Date(Date.now() - 28 * 24 * 60 * 60 * 1000))
            .filter((s) => s.amount >= 10000);
          
          const progress = (recentSavings.length / 4) * 100;
          setEligibilityProgress(Math.min(progress, 100));
        }
      }
    }
    
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loan Eligibility Progress</CardTitle>
          <CardDescription>
            Save UGX 10,000 or more per week for 4 consecutive weeks to qualify for a loan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress towards eligibility</span>
              <span className="font-medium">{Math.round(eligibilityProgress)}%</span>
            </div>
            <Progress value={eligibilityProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {eligibilityProgress >= 100 
                ? "✓ You are eligible for a loan!" 
                : `Save UGX 10,000 per week to reach eligibility`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Savings History</CardTitle>
          <CardDescription>Your weekly savings record</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week Period</TableHead>
                <TableHead className="text-right">Amount Saved</TableHead>
                <TableHead>Eligible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No savings records yet
                  </TableCell>
                </TableRow>
              ) : (
                savings.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.week_start), "MMM dd")} - {format(new Date(record.week_end), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      UGX {record.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {record.amount >= 10000 ? (
                        <span className="text-success">✓ Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SavingsTracker;
