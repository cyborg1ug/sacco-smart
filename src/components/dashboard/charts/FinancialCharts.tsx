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

// Vibrant color palette for charts
const COLORS = [
  "hsl(220, 90%, 56%)",   // Blue
  "hsl(142, 76%, 36%)",   // Green
  "hsl(38, 92%, 50%)",    // Orange
  "hsl(328, 85%, 70%)",   // Pink
  "hsl(280, 80%, 60%)",   // Purple
  "hsl(190, 90%, 50%)",   // Cyan
];

const FinancialCharts = ({ transactionData, savingsData, loanData, balanceData }: FinancialChartsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {transactionData && transactionData.length > 0 && (
        <Card className="overflow-hidden border-l-4 border-l-blue-500">
          <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
            <CardTitle className="text-base">💰 Deposits vs Withdrawals</CardTitle>
            <CardDescription>Monthly transaction comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={transactionData}>
                <defs>
                  <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="withdrawalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 72%, 50%)" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(0, 72%, 60%)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`UGX ${value.toLocaleString()}`, '']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
                <Legend />
                <Bar dataKey="deposits" name="✅ Deposits" fill="url(#depositGradient)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="withdrawals" name="📤 Withdrawals" fill="url(#withdrawalGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {savingsData && savingsData.length > 0 && (
        <Card className="overflow-hidden border-l-4 border-l-green-500">
          <CardHeader className="bg-gradient-to-r from-green-500/10 to-transparent">
            <CardTitle className="text-base">📈 Weekly Savings Trend</CardTitle>
            <CardDescription>Savings progression over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={savingsData}>
                <defs>
                  <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`UGX ${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  fill="url(#savingsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {loanData && loanData.length > 0 && (
        <Card className="overflow-hidden border-l-4 border-l-purple-500">
          <CardHeader className="bg-gradient-to-r from-purple-500/10 to-transparent">
            <CardTitle className="text-base">🏦 Loan Portfolio Distribution</CardTitle>
            <CardDescription>Loans by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={loanData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {loanData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} loans`, '']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {balanceData && balanceData.length > 0 && (
        <Card className="overflow-hidden border-l-4 border-l-orange-500">
          <CardHeader className="bg-gradient-to-r from-orange-500/10 to-transparent">
            <CardTitle className="text-base">💵 Balance Trend</CardTitle>
            <CardDescription>Account balance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={balanceData}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(38, 92%, 50%)" />
                    <stop offset="100%" stopColor="hsl(38, 92%, 60%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`UGX ${value.toLocaleString()}`, 'Balance']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="url(#balanceGradient)" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(38, 92%, 50%)', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: 'hsl(38, 92%, 50%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancialCharts;
