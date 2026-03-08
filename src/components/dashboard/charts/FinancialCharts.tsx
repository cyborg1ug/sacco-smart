import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";

interface FinancialChartsProps {
  transactionData?: {
    month: string;
    deposits: number;
    withdrawals: number;
  }[];
  savingsData?: {
    week: string;
    amount: number;
  }[];
  loanData?: {
    name: string;
    value: number;
  }[];
  balanceData?: {
    date: string;
    balance: number;
  }[];
}

const COLORS = [
  "hsl(231, 98%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(328, 85%, 65%)",
  "hsl(280, 80%, 60%)",
  "hsl(190, 90%, 50%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  fontSize: "12px",
};

const FinancialCharts = ({ transactionData, savingsData, loanData, balanceData }: FinancialChartsProps) => {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {transactionData && transactionData.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-br from-success/10 via-success/5 to-transparent border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-success/15 flex items-center justify-center">
                <span className="text-sm">💰</span>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Deposits vs Withdrawals</CardTitle>
                <CardDescription className="text-xs">Monthly transaction comparison</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-3 px-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={transactionData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(142, 71%, 55%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(0, 84%, 70%)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`UGX ${v.toLocaleString()}`, ""]} contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="deposits" name="Deposits" fill="url(#depositGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="withdrawals" name="Withdrawals" fill="url(#withdrawalGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {savingsData && savingsData.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <span className="text-sm">📈</span>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Weekly Savings Trend</CardTitle>
                <CardDescription className="text-xs">Savings progression over time</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-3 px-3">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={savingsData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(231, 98%, 60%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(231, 98%, 60%)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`UGX ${v.toLocaleString()}`, "Amount"]} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="amount" stroke="hsl(231, 98%, 60%)" strokeWidth={2.5} fill="url(#savingsGradient)" dot={false} activeDot={{ r: 5, fill: "hsl(231, 98%, 60%)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {loanData && loanData.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-br from-chart-5/10 via-chart-5/5 to-transparent border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-chart-5/15 flex items-center justify-center">
                <span className="text-sm">🏦</span>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Loan Portfolio Distribution</CardTitle>
                <CardDescription className="text-xs">Loans by status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-3 px-3">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={loanData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={80} innerRadius={30} dataKey="value" paddingAngle={3}>
                  {loanData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} loans`, ""]} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {balanceData && balanceData.length > 0 && (
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center">
                <span className="text-sm">💵</span>
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Balance Trend</CardTitle>
                <CardDescription className="text-xs">Account balance over time</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-3 px-3">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={balanceData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`UGX ${v.toLocaleString()}`, "Balance"]} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="balance" stroke="hsl(38, 92%, 50%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "hsl(38, 92%, 50%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancialCharts;
