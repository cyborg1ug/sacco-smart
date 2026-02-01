import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Calculator, TrendingDown } from "lucide-react";
import { format, addMonths } from "date-fns";

interface ActiveLoan {
  id: string;
  amount: number;
  total_amount: number;
  outstanding_balance: number;
  interest_rate: number;
  repayment_months: number;
  disbursed_at: string | null;
  created_at: string;
  status: string;
}

interface ScheduleEntry {
  month: number;
  dueDate: Date;
  principal: number;
  interest: number;
  totalPayment: number;
  remainingBalance: number;
  isPaid: boolean;
}

interface LoanRepaymentScheduleProps {
  accountIds: string[];
}

const LoanRepaymentSchedule = ({ accountIds }: LoanRepaymentScheduleProps) => {
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveLoans();
  }, [accountIds]);

  const loadActiveLoans = async () => {
    if (!accountIds.length) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .in("account_id", accountIds)
      .in("status", ["disbursed", "active"])
      .gt("outstanding_balance", 0);

    if (error) {
      console.error("Error loading loans:", error);
    } else {
      setLoans(data || []);
    }
    setLoading(false);
  };

  const generateSchedule = (loan: ActiveLoan): ScheduleEntry[] => {
    const schedule: ScheduleEntry[] = [];
    const startDate = loan.disbursed_at ? new Date(loan.disbursed_at) : new Date(loan.created_at);
    const monthlyInterestRate = loan.interest_rate / 100;
    const monthlyInterest = loan.amount * monthlyInterestRate;
    const monthlyPrincipal = loan.amount / loan.repayment_months;
    const monthlyPayment = monthlyPrincipal + monthlyInterest;
    
    let remainingBalance = loan.total_amount;
    const alreadyPaid = loan.total_amount - loan.outstanding_balance;
    let paidAmount = alreadyPaid;

    for (let month = 1; month <= loan.repayment_months; month++) {
      const dueDate = addMonths(startDate, month);
      const isPaid = paidAmount >= monthlyPayment;
      
      if (isPaid) {
        paidAmount -= monthlyPayment;
      }
      
      remainingBalance -= monthlyPayment;

      schedule.push({
        month,
        dueDate,
        principal: monthlyPrincipal,
        interest: monthlyInterest,
        totalPayment: monthlyPayment,
        remainingBalance: Math.max(0, remainingBalance),
        isPaid,
      });
    }

    return schedule;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Loan Repayment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (loans.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {loans.map((loan) => {
        const schedule = generateSchedule(loan);
        const paidMonths = schedule.filter(s => s.isPaid).length;
        const progressPercent = ((loan.total_amount - loan.outstanding_balance) / loan.total_amount) * 100;

        return (
          <Card key={loan.id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-chart-1/5 to-chart-2/5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-5 w-5 text-primary" />
                    Repayment Schedule
                  </CardTitle>
                  <CardDescription>
                    {loan.repayment_months} month(s) at {loan.interest_rate}% monthly interest
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                    {paidMonths}/{loan.repayment_months} Paid
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {progressPercent.toFixed(1)}% Complete
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/30">
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">Principal</p>
                  <p className="text-lg font-bold text-foreground">UGX {loan.amount.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">Total Interest</p>
                  <p className="text-lg font-bold text-chart-1">UGX {(loan.total_amount - loan.amount).toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">Monthly Payment</p>
                  <p className="text-lg font-bold text-chart-2">UGX {(loan.total_amount / loan.repayment_months).toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-bold text-destructive">UGX {loan.outstanding_balance.toLocaleString()}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Repayment Progress</span>
                  <span className="font-medium">{progressPercent.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-success via-chart-1 to-chart-2 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Schedule Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Month</TableHead>
                      <TableHead className="text-xs">Due Date</TableHead>
                      <TableHead className="text-xs text-right">Principal</TableHead>
                      <TableHead className="text-xs text-right">Interest</TableHead>
                      <TableHead className="text-xs text-right">Payment</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((entry) => (
                      <TableRow 
                        key={entry.month} 
                        className={entry.isPaid ? "bg-success/5" : ""}
                      >
                        <TableCell className="font-medium">{entry.month}</TableCell>
                        <TableCell className="text-xs">
                          {format(entry.dueDate, "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          UGX {entry.principal.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs text-chart-1">
                          UGX {entry.interest.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          UGX {entry.totalPayment.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          UGX {entry.remainingBalance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.isPaid ? (
                            <Badge className="bg-success text-success-foreground text-[10px]">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default LoanRepaymentSchedule;
