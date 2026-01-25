import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Loader2 } from "lucide-react";

interface LoanStats {
  status: string;
  count: number;
  totalAmount: number;
}

interface LoanCompletionChartProps {
  accountIds?: string[];
  isAdmin?: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--secondary))",
  "hsl(142, 76%, 36%)", // green for completed
  "hsl(45, 93%, 47%)",  // yellow/warning
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  active: "Active",
  disbursed: "Disbursed",
  completed: "Completed",
  fully_paid: "Fully Paid",
  rejected: "Rejected",
};

const LoanCompletionChart = ({ accountIds, isAdmin = false }: LoanCompletionChartProps) => {
  const [loanStats, setLoanStats] = useState<LoanStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoanStats();
  }, [accountIds, isAdmin]);

  const loadLoanStats = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("loans")
        .select("status, amount, outstanding_balance");

      // For member view, filter by their account IDs
      if (!isAdmin && accountIds && accountIds.length > 0) {
        query = query.in("account_id", accountIds);
      }

      const { data: loans, error } = await query;

      if (error) throw error;

      // Group by status
      const statsMap = new Map<string, { count: number; totalAmount: number }>();
      
      loans?.forEach((loan) => {
        const status = loan.status;
        const existing = statsMap.get(status) || { count: 0, totalAmount: 0 };
        statsMap.set(status, {
          count: existing.count + 1,
          totalAmount: existing.totalAmount + Number(loan.amount),
        });
      });

      const stats: LoanStats[] = Array.from(statsMap.entries()).map(([status, data]) => ({
        status: STATUS_LABELS[status] || status,
        count: data.count,
        totalAmount: data.totalAmount,
      }));

      setLoanStats(stats);
    } catch (error) {
      console.error("Error loading loan stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan Status Overview</CardTitle>
          <CardDescription>Active loans tracking</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (loanStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan Status Overview</CardTitle>
          <CardDescription>Active loans tracking</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground">
          No loan data available
        </CardContent>
      </Card>
    );
  }

  const pieData = loanStats.map((stat) => ({
    name: stat.status,
    value: stat.count,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Pie Chart - Loan Count by Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loans by Status</CardTitle>
          <CardDescription>Distribution of loan statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} loans`, ""]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bar Chart - Loan Amount by Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan Amounts by Status</CardTitle>
          <CardDescription>Total loan value per status</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={loanStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                className="text-xs"
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <YAxis type="category" dataKey="status" className="text-xs" width={80} />
              <Tooltip
                formatter={(value: number) => [`UGX ${value.toLocaleString()}`, "Amount"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                dataKey="totalAmount"
                name="Total Amount"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoanCompletionChart;
