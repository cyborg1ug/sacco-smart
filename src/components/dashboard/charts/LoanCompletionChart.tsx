import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { Loader2, TrendingUp } from "lucide-react";

interface ActiveLoan {
  id: string;
  amount: number;
  total_amount: number;
  outstanding_balance: number;
  status: string;
  account_id: string;
  account_number?: string;
  member_name?: string;
  interest_rate?: number;
  repayment_months?: number;
}

interface LoanCompletionChartProps {
  accountIds?: string[];
  isAdmin?: boolean;
}

// Vibrant color palette for charts
const CHART_COLORS = {
  disbursed: "hsl(220, 90%, 56%)",
  repaid: "hsl(142, 76%, 36%)",
  outstanding: "hsl(38, 92%, 50%)",
  bars: [
    "hsl(328, 85%, 70%)",
    "hsl(220, 90%, 56%)",
    "hsl(142, 76%, 36%)",
    "hsl(38, 92%, 50%)",
    "hsl(351, 94%, 71%)",
    "hsl(280, 80%, 60%)",
    "hsl(190, 90%, 50%)",
    "hsl(45, 100%, 60%)",
  ],
};

const LoanCompletionChart = ({ accountIds, isAdmin = false }: LoanCompletionChartProps) => {
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveLoans();
    
    // Subscribe to real-time loan updates
    const loansChannel = supabase
      .channel('loans-chart-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loans' },
        () => {
          loadActiveLoans();
        }
      )
      .subscribe();

    // Subscribe to real-time transaction updates
    const transactionsChannel = supabase
      .channel('transactions-chart-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload: any) => {
          if (payload.new?.transaction_type === 'loan_repayment' || 
              payload.new?.transaction_type === 'loan_disbursement') {
            loadActiveLoans();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(loansChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [accountIds, isAdmin]);

  const loadActiveLoans = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("loans")
        .select("id, amount, total_amount, outstanding_balance, status, account_id, interest_rate, repayment_months")
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
      <Card className="overflow-hidden border-l-4 border-l-primary">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-chart-1/5 to-transparent">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            Active Loans Tracking
          </CardTitle>
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

  // Calculate total interest for summary
  const totalInterest = activeLoans.reduce((sum, l) => sum + (l.total_amount - l.amount), 0);

  // Prepare chart data: disbursed vs repaid for each loan
  const chartData = activeLoans.map((loan, index) => {
    const repaidAmount = loan.total_amount - loan.outstanding_balance;
    const loanInterest = loan.total_amount - loan.amount;
    return {
      name: isAdmin ? loan.member_name?.split(' ')[0] || 'Member' : `Loan ${index + 1}`,
      fullName: isAdmin ? loan.member_name : `Loan ${index + 1}`,
      disbursed: loan.amount,
      repaid: repaidAmount,
      outstanding: loan.outstanding_balance,
      interest: loanInterest,
      colorIndex: index % CHART_COLORS.bars.length,
    };
  });

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-chart-1/5 to-chart-2/5">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Active Loans Tracking
        </CardTitle>
        <CardDescription>
          {isAdmin 
            ? `${activeLoans.length} active loan(s) - Disbursed vs Repaid amounts`
            : `Your active loan(s) - Disbursed vs Repaid amounts`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="disbursedGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(220, 90%, 56%)" />
                <stop offset="100%" stopColor="hsl(220, 90%, 66%)" />
              </linearGradient>
              <linearGradient id="repaidGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(142, 76%, 36%)" />
                <stop offset="100%" stopColor="hsl(142, 76%, 46%)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
            <XAxis
              type="number"
              className="text-xs"
              tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}K`}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              className="text-xs" 
              width={isAdmin ? 80 : 60}
              tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `UGX ${value.toLocaleString()}`,
                name === "disbursed" ? "💰 Disbursed" : name === "repaid" ? "✅ Repaid" : "⏳ Outstanding"
              ]}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload;
                return item?.fullName || label;
              }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => (
                <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>
                  {value === "disbursed" ? "💰 Disbursed" : "✅ Repaid"}
                </span>
              )}
            />
            <Bar
              dataKey="disbursed"
              name="disbursed"
              fill="url(#disbursedGradient)"
              radius={[0, 6, 6, 0]}
              barSize={20}
            />
            <Bar
              dataKey="repaid"
              name="repaid"
              fill="url(#repaidGradient)"
              radius={[0, 6, 6, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="text-xs text-muted-foreground">Total Disbursed</p>
            <p className="text-sm font-bold text-primary">
              UGX {activeLoans.reduce((sum, l) => sum + l.amount, 0).toLocaleString()}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-chart-3/10">
            <p className="text-xs text-muted-foreground">Total Interest</p>
            <p className="text-sm font-bold text-chart-3">
              UGX {totalInterest.toLocaleString()}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-success/10">
            <p className="text-xs text-muted-foreground">Total Repaid</p>
            <p className="text-sm font-bold text-success">
              UGX {activeLoans.reduce((sum, l) => sum + (l.total_amount - l.outstanding_balance), 0).toLocaleString()}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-warning/10">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-sm font-bold text-warning">
              UGX {activeLoans.reduce((sum, l) => sum + l.outstanding_balance, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoanCompletionChart;
