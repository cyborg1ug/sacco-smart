import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { Loader2, TrendingUp, Percent, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { addMonths, isAfter } from "date-fns";

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
  disbursed_at?: string | null;
  disbursed_amount?: number;
  repaid_amount?: number;
  isOverdue?: boolean;
}

interface InterestReceived {
  loan_id: string;
  member_name: string;
  total_interest: number;
  expected_interest: number;
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
  overdueDisbursed: "hsl(0, 84%, 60%)",
  overdueRepaid: "hsl(0, 84%, 42%)",
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

const isLoanOverdue = (loan: ActiveLoan): boolean => {
  if (!loan.disbursed_at || !loan.repayment_months) return false;
  const expectedEndDate = addMonths(new Date(loan.disbursed_at), loan.repayment_months);
  return isAfter(new Date(), expectedEndDate) && loan.outstanding_balance > 0;
};

const LoanCompletionChart = ({ accountIds, isAdmin = false }: LoanCompletionChartProps) => {
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [interestData, setInterestData] = useState<InterestReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("loans");

  useEffect(() => {
    loadActiveLoans();
    loadInterestReceived();
    
    const loansChannel = supabase
      .channel('loans-chart-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        loadActiveLoans();
        loadInterestReceived();
      })
      .subscribe();

    const transactionsChannel = supabase
      .channel('transactions-chart-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload: any) => {
        if (
          payload.new?.transaction_type === 'loan_repayment' ||
          payload.new?.transaction_type === 'loan_disbursement' ||
          payload.new?.transaction_type === 'interest_received'
        ) {
          loadActiveLoans();
          loadInterestReceived();
        }
      })
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
        .select("id, amount, total_amount, outstanding_balance, status, account_id, interest_rate, repayment_months, disbursed_at")
        .in("status", ["disbursed", "active"])
        .gt("outstanding_balance", 0);

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

      const loanIds = loans.map(l => l.id);
      const { data: loanTxns } = await supabase
        .from("transactions")
        .select("loan_id, amount, transaction_type")
        .in("loan_id", loanIds)
        .in("transaction_type", ["loan_disbursement", "loan_repayment"])
        .eq("status", "approved");

      const disbursedMap = new Map<string, number>();
      const repaidMap = new Map<string, number>();
      loanTxns?.forEach(t => {
        if (t.transaction_type === "loan_disbursement") {
          disbursedMap.set(t.loan_id!, (disbursedMap.get(t.loan_id!) || 0) + Number(t.amount));
        } else if (t.transaction_type === "loan_repayment") {
          repaidMap.set(t.loan_id!, (repaidMap.get(t.loan_id!) || 0) + Number(t.amount));
        }
      });

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

      const loansWithNames = loans.map(l => {
        const loanData = {
          ...l,
          account_number: accountsMap.get(l.account_id)?.account_number || "Unknown",
          member_name: accountsMap.get(l.account_id)?.member_name || "Unknown",
          disbursed_amount: disbursedMap.get(l.id) || l.amount,
          repaid_amount: repaidMap.get(l.id) || 0,
        };
        return { ...loanData, isOverdue: isLoanOverdue(loanData) };
      });

      setActiveLoans(loansWithNames);
    } catch (error) {
      console.error("Error loading active loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInterestReceived = async () => {
    try {
      const { data: interestTxns } = await supabase
        .from("transactions")
        .select("loan_id, amount, account_id")
        .eq("transaction_type", "interest_received")
        .eq("status", "approved");

      if (!interestTxns || interestTxns.length === 0) {
        setInterestData([]);
        return;
      }

      const loanIds = [...new Set(interestTxns.map(t => t.loan_id).filter(Boolean))];
      const { data: loansData } = await supabase
        .from("loans")
        .select("id, amount, interest_rate, repayment_months, account_id")
        .in("id", loanIds);

      const accountIds = [...new Set(interestTxns.map(t => t.account_id))];
      const { data: accountsData } = await supabase
        .from("accounts")
        .select("id, user_id, account_type")
        .in("id", accountIds);

      const mainUserIds = [...new Set(accountsData?.filter(a => a.account_type === 'main').map(a => a.user_id) || [])];
      const subAccIds = accountsData?.filter(a => a.account_type === 'sub').map(a => a.id) || [];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", mainUserIds);

      const { data: subProfilesData } = await supabase
        .from("sub_account_profiles")
        .select("account_id, full_name")
        .in("account_id", subAccIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
      const subProfilesMap = new Map(subProfilesData?.map(p => [p.account_id, p.full_name]) || []);
      const accountNameMap = new Map(accountsData?.map(a => [
        a.id,
        a.account_type === 'sub' ? subProfilesMap.get(a.id) : profilesMap.get(a.user_id)
      ]) || []);

      const interestByLoan = new Map<string, { total: number; accountId: string }>();
      interestTxns.forEach(t => {
        if (t.loan_id) {
          const existing = interestByLoan.get(t.loan_id) || { total: 0, accountId: t.account_id };
          existing.total += Number(t.amount);
          interestByLoan.set(t.loan_id, existing);
        }
      });

      const loansMap = new Map(loansData?.map(l => [l.id, l]) || []);

      const result: InterestReceived[] = [];
      interestByLoan.forEach((value, loanId) => {
        const loan = loansMap.get(loanId);
        if (loan) {
          const expectedInterest = loan.amount * (loan.interest_rate / 100) * (loan.repayment_months || 1);
          result.push({
            loan_id: loanId,
            member_name: accountNameMap.get(value.accountId) || "Unknown",
            total_interest: value.total,
            expected_interest: expectedInterest
          });
        }
      });

      setInterestData(result);
    } catch (error) {
      console.error("Error loading interest data:", error);
    }
  };

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
        <CardHeader className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Loans & Interest Tracking</CardTitle>
              <CardDescription className="text-xs">Disbursed vs Repaid amounts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (activeLoans.length === 0 && interestData.length === 0) {
    return null;
  }

  const overdueCount = activeLoans.filter(l => l.isOverdue).length;

  const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.disbursed_amount || l.amount), 0);
  const totalExpectedInterest = activeLoans.reduce((sum, l) => sum + (l.total_amount - l.amount), 0);
  const totalInterestReceived = interestData.reduce((sum, i) => sum + i.total_interest, 0);
  const totalRepaid = activeLoans.reduce((sum, l) => sum + (l.repaid_amount || 0), 0);
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + l.outstanding_balance, 0);

  const chartData = activeLoans.map((loan, index) => {
    const repaidAmount = loan.repaid_amount || 0;
    const loanInterest = loan.total_amount - loan.amount;
    return {
      name: isAdmin ? loan.member_name?.split(' ')[0] || 'Member' : `Loan ${index + 1}`,
      fullName: isAdmin ? loan.member_name : `Loan ${index + 1}`,
      disbursed: loan.disbursed_amount || loan.amount,
      repaid: repaidAmount,
      outstanding: loan.outstanding_balance,
      interest: loanInterest,
      isOverdue: loan.isOverdue,
      colorIndex: index % CHART_COLORS.bars.length,
    };
  });

  const interestChartData = interestData.map((item, index) => ({
    name: item.member_name?.split(' ')[0] || 'Member',
    fullName: item.member_name,
    received: item.total_interest,
    expected: item.expected_interest,
    colorIndex: index % CHART_COLORS.bars.length,
  }));

  // Custom Y-axis tick that adds overdue indicator
  const CustomYAxisTick = ({ x, y, payload }: any) => {
    const item = chartData.find(d => d.name === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={-4}
          y={0}
          dy={4}
          textAnchor="end"
          fontSize={11}
          fill={item?.isOverdue ? "hsl(0, 84%, 55%)" : "hsl(var(--foreground))"}
          fontWeight={item?.isOverdue ? 700 : 400}
        >
          {payload.value}
        </text>
        {item?.isOverdue && (
          <text x={-4} y={-9} dy={4} textAnchor="end" fontSize={9} fill="hsl(0, 84%, 55%)">
            ⚠
          </text>
        )}
      </g>
    );
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
      <CardHeader className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/40 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Loans & Interest Tracking</CardTitle>
              <CardDescription className="text-xs">
                {isAdmin
                  ? `${activeLoans.length} active loan(s) — Financial overview`
                  : `Your active loan(s) — Financial overview`
                }
              </CardDescription>
            </div>
          </div>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-[10px] shrink-0">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} Overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="loans" className="text-xs sm:text-sm gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Loans
            </TabsTrigger>
            <TabsTrigger value="interest" className="text-xs sm:text-sm gap-1.5">
              <Percent className="h-3.5 w-3.5" />
              Interest Received
            </TabsTrigger>
          </TabsList>

          <TabsContent value="loans" className="mt-0">
            {activeLoans.length > 0 ? (
              <>
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <p className="text-[11px] text-destructive font-medium">
                      Red bars indicate overdue loans — repayment period has passed
                    </p>
                  </div>
                )}
                <ResponsiveContainer width="100%" height={Math.max(280, activeLoans.length * 52)}>
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
                      <linearGradient id="overdueDisbursedGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(0, 84%, 55%)" />
                        <stop offset="100%" stopColor="hsl(0, 84%, 65%)" />
                      </linearGradient>
                      <linearGradient id="overdueRepaidGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(0, 84%, 38%)" />
                        <stop offset="100%" stopColor="hsl(0, 84%, 48%)" />
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
                      tick={<CustomYAxisTick />}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `UGX ${value.toLocaleString()}`,
                        name === "disbursed" ? "💰 Disbursed" : "✅ Repaid"
                      ]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        const overdueMark = item?.isOverdue ? " ⚠️ OVERDUE" : "";
                        return (item?.fullName || label) + overdueMark;
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
                    <Bar dataKey="disbursed" name="disbursed" radius={[0, 6, 6, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`disbursed-${index}`}
                          fill={entry.isOverdue ? "url(#overdueDisbursedGradient)" : "url(#disbursedGradient)"}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="repaid" name="repaid" radius={[0, 6, 6, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`repaid-${index}`}
                          fill={entry.isOverdue ? "url(#overdueRepaidGradient)" : "url(#repaidGradient)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No active loans to display
              </div>
            )}
          </TabsContent>

          <TabsContent value="interest" className="mt-0">
            {interestChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={interestChartData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="receivedGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(38, 92%, 50%)" />
                      <stop offset="100%" stopColor="hsl(38, 92%, 60%)" />
                    </linearGradient>
                    <linearGradient id="expectedGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(280, 80%, 60%)" />
                      <stop offset="100%" stopColor="hsl(280, 80%, 70%)" />
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
                      name === "received" ? "💵 Received" : "📊 Expected"
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
                        {value === "received" ? "💵 Received" : "📊 Expected"}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="received"
                    name="received"
                    fill="url(#receivedGradient)"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="expected"
                    name="expected"
                    fill="url(#expectedGradient)"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No interest received yet
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4 pt-4 border-t border-border/60">
          <div className="text-center p-2.5 rounded-xl bg-primary/10">
            <p className="text-[10px] text-muted-foreground">Disbursed</p>
            <p className="text-xs font-bold text-primary">UGX {totalDisbursed.toLocaleString()}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-chart-3/10">
            <p className="text-[10px] text-muted-foreground">Exp. Interest</p>
            <p className="text-xs font-bold text-chart-3">UGX {totalExpectedInterest.toLocaleString()}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-warning/10">
            <p className="text-[10px] text-muted-foreground">Int. Received</p>
            <p className="text-xs font-bold text-warning">UGX {totalInterestReceived.toLocaleString()}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-success/10">
            <p className="text-[10px] text-muted-foreground">Repaid</p>
            <p className="text-xs font-bold text-success">UGX {totalRepaid.toLocaleString()}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-destructive/10">
            <p className="text-[10px] text-muted-foreground">Outstanding</p>
            <p className="text-xs font-bold text-destructive">UGX {totalOutstanding.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoanCompletionChart;
