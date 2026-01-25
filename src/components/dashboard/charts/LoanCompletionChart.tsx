import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { Loader2 } from "lucide-react";

interface ActiveLoan {
  id: string;
  amount: number;
  total_amount: number;
  outstanding_balance: number;
  status: string;
  account_id: string;
  account_number?: string;
  member_name?: string;
}

interface LoanCompletionChartProps {
  accountIds?: string[];
  isAdmin?: boolean;
}

const LoanCompletionChart = ({ accountIds, isAdmin = false }: LoanCompletionChartProps) => {
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveLoans();
  }, [accountIds, isAdmin]);

  const loadActiveLoans = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("loans")
        .select("id, amount, total_amount, outstanding_balance, status, account_id")
        .in("status", ["disbursed", "active"])
        .gt("outstanding_balance", 0);

      // For member view, filter by their account IDs
      if (!isAdmin && accountIds && accountIds.length > 0) {
        query = query.in("account_id", accountIds);
      }

      const { data: loans, error } = await query;

      if (error) throw error;

      if (!loans || loans.length === 0) {
        setActiveLoans([]);
        setLoading(false);
        return;
      }

      // Get account info for names
      const loanAccountIds = [...new Set(loans.map(l => l.account_id))];
      const { data: accountsData } = await supabase
        .from("accounts")
        .select("id, account_number, user_id, account_type")
        .in("id", loanAccountIds);

      if (!accountsData) {
        setActiveLoans(loans);
        setLoading(false);
        return;
      }

      // Get profiles for main accounts and sub-accounts
      const mainAccountUserIds = [...new Set(accountsData.filter(a => a.account_type === 'main').map(a => a.user_id))];
      const subAccountIds = accountsData.filter(a => a.account_type === 'sub').map(a => a.id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", mainAccountUserIds);

      const { data: subProfilesData } = await supabase
        .from("sub_account_profiles")
        .select("account_id, full_name")
        .in("account_id", subAccountIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
      const subProfilesMap = new Map(subProfilesData?.map(p => [p.account_id, p.full_name]) || []);

      const accountsMap = new Map(accountsData.map(a => {
        let fullName = "Unknown";
        if (a.account_type === 'sub') {
          fullName = subProfilesMap.get(a.id) || "Unknown";
        } else {
          fullName = profilesMap.get(a.user_id) || "Unknown";
        }
        return [a.id, { account_number: a.account_number, member_name: fullName }];
      }));

      const loansWithNames = loans.map(l => ({
        ...l,
        account_number: accountsMap.get(l.account_id)?.account_number || "Unknown",
        member_name: accountsMap.get(l.account_id)?.member_name || "Unknown"
      }));

      setActiveLoans(loansWithNames);
    } catch (error) {
      console.error("Error loading active loans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Loans Tracking</CardTitle>
          <CardDescription>Disbursed vs Repaid amounts</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Don't show chart if no active loans
  if (activeLoans.length === 0) {
    return null;
  }

  // Prepare chart data: disbursed vs repaid for each loan
  const chartData = activeLoans.map((loan) => {
    const repaidAmount = loan.total_amount - loan.outstanding_balance;
    return {
      name: isAdmin ? loan.member_name : `Loan`,
      disbursed: loan.amount,
      repaid: repaidAmount,
      outstanding: loan.outstanding_balance,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Active Loans Tracking</CardTitle>
        <CardDescription>
          {isAdmin 
            ? `${activeLoans.length} active loan(s) - Disbursed vs Repaid amounts`
            : `Your active loan(s) - Disbursed vs Repaid amounts`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              className="text-xs"
              tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              className="text-xs" 
              width={isAdmin ? 100 : 60}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `UGX ${value.toLocaleString()}`,
                name === "disbursed" ? "Disbursed" : name === "repaid" ? "Repaid" : "Outstanding"
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar
              dataKey="disbursed"
              name="Disbursed"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="repaid"
              name="Repaid"
              fill="hsl(142, 76%, 36%)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default LoanCompletionChart;
