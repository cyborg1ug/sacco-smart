import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

interface OverviewChartsProps {
  repaymentTrends: { month: string; expected: number; collected: number; overdue: number }[];
  savingsActivity: { month: string; deposits: number; withdrawals: number }[];
  memberContributions: { name: string; amount: number }[];
  loanDistribution: { name: string; value: number }[];
}

const fmt = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : `${v}`;

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  boxShadow: "0 8px 24px hsl(222 47% 11% / 0.18)",
  fontSize: "12px",
};

const C = {
  expected: "hsl(231, 55%, 58%)",
  collected: "hsl(168, 76%, 42%)",
  overdue: "hsl(0, 84%, 60%)",
  deposits: "hsl(168, 76%, 45%)",
  withdrawals: "hsl(0, 84%, 60%)",
  donut: [
    "hsl(168, 76%, 45%)",
    "hsl(210, 90%, 56%)",
    "hsl(38, 92%, 50%)",
    "hsl(280, 80%, 65%)",
    "hsl(0, 84%, 62%)",
    "hsl(190, 85%, 50%)",
  ],
};

const ChartCard = ({
  title, description, children,
}: { title: string; description: string; children: React.ReactNode }) => (
  <Card className="rounded-2xl border border-border/60 shadow-sm overflow-hidden">
    <CardHeader className="pb-2 pt-5 px-5">
      <CardTitle className="text-base font-bold">{title}</CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="px-3 pb-4 pt-2">{children}</CardContent>
  </Card>
);

const OverviewCharts = ({
  repaymentTrends, savingsActivity, memberContributions, loanDistribution,
}: OverviewChartsProps) => {
  const distTotal = loanDistribution.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Repayment Trends */}
      <ChartCard title="Repayment Trends" description="Expected vs collected vs overdue">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={repaymentTrends} margin={{ top: 10, right: 8, left: -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="expected" name="Expected" fill={C.expected} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="collected" name="Collected" fill={C.collected} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="overdue" name="Overdue" fill={C.overdue} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monthly Savings Activity */}
      <ChartCard title="Monthly Savings Activity" description="Deposits vs withdrawals trend">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={savingsActivity} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.deposits} stopOpacity={0.45} />
                <stop offset="100%" stopColor={C.deposits} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="witGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.withdrawals} stopOpacity={0.3} />
                <stop offset="100%" stopColor={C.withdrawals} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="deposits" name="Deposits" stroke={C.deposits} strokeWidth={2.5} fill="url(#depGrad)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke={C.withdrawals} strokeWidth={2.5} fill="url(#witGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top Member Contributions */}
      <ChartCard title="Top Member Contributions" description="Total savings by member">
        <ResponsiveContainer width="100%" height={Math.max(250, memberContributions.length * 40)}>
          <BarChart data={memberContributions} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
            <Bar dataKey="amount" name="Savings" fill={C.collected} radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Loan Distribution */}
      <ChartCard title="Loan Distribution" description="By purpose category">
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={loanDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {loanDistribution.map((_, i) => (
                  <Cell key={i} fill={C.donut[i % C.donut.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `UGX ${v.toLocaleString()}`} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-full px-2 space-y-1.5 mt-2">
            {loanDistribution.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.donut[i % C.donut.length] }} />
                  <span className="truncate text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-semibold tabular-nums">{Math.round((d.value / distTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
};

export default OverviewCharts;
