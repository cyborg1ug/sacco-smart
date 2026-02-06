import { differenceInMonths, differenceInDays } from "date-fns";

/**
 * Calculate the dynamic interest for a loan based on months elapsed from disbursement
 * Interest accumulates at 2% of the loan principal per month
 */
export const calculateDynamicInterest = (
  principal: number,
  interestRatePerMonth: number,
  disbursedAt: string | Date | null
): {
  monthsElapsed: number;
  totalInterest: number;
  currentTotalAmount: number;
} => {
  if (!disbursedAt) {
    return {
      monthsElapsed: 0,
      totalInterest: 0,
      currentTotalAmount: principal,
    };
  }

  const disbursementDate = new Date(disbursedAt);
  const today = new Date();
  
  // Calculate full months elapsed + partial month (rounded up to at least 1)
  const daysElapsed = differenceInDays(today, disbursementDate);
  const monthsElapsed = Math.max(1, Math.ceil(daysElapsed / 30));
  
  // Interest = Principal × Rate × Months
  const totalInterest = principal * (interestRatePerMonth / 100) * monthsElapsed;
  const currentTotalAmount = principal + totalInterest;

  return {
    monthsElapsed,
    totalInterest,
    currentTotalAmount,
  };
};

/**
 * Calculate the current outstanding balance considering dynamic interest
 */
export const calculateCurrentOutstanding = (
  principal: number,
  interestRatePerMonth: number,
  disbursedAt: string | Date | null,
  totalRepaid: number
): {
  monthsElapsed: number;
  totalInterest: number;
  currentTotalAmount: number;
  currentOutstanding: number;
} => {
  const { monthsElapsed, totalInterest, currentTotalAmount } = calculateDynamicInterest(
    principal,
    interestRatePerMonth,
    disbursedAt
  );

  const currentOutstanding = Math.max(0, currentTotalAmount - totalRepaid);

  return {
    monthsElapsed,
    totalInterest,
    currentTotalAmount,
    currentOutstanding,
  };
};

/**
 * Calculate principal and interest portions of a repayment
 */
export const calculateRepaymentBreakdown = (
  repaymentAmount: number,
  loanPrincipal: number,
  totalInterest: number
): {
  principalPortion: number;
  interestPortion: number;
} => {
  const totalAmount = loanPrincipal + totalInterest;
  
  if (totalAmount <= 0) {
    return { principalPortion: repaymentAmount, interestPortion: 0 };
  }

  // Allocate repayment proportionally between principal and interest
  const principalRatio = loanPrincipal / totalAmount;
  const interestRatio = totalInterest / totalAmount;

  const principalPortion = Math.round(repaymentAmount * principalRatio);
  const interestPortion = Math.round(repaymentAmount * interestRatio);

  return { principalPortion, interestPortion };
};

/**
 * Generate a repayment schedule based on current outstanding
 */
export const generateRepaymentSchedule = (
  principal: number,
  interestRatePerMonth: number,
  disbursedAt: string | Date | null,
  plannedMonths: number,
  totalRepaid: number = 0
): {
  schedule: Array<{
    month: number;
    dueDate: Date;
    monthlyPrincipal: number;
    monthlyInterest: number;
    totalMonthly: number;
    cumulativeInterest: number;
    remainingBalance: number;
  }>;
  summary: {
    monthsElapsed: number;
    currentInterest: number;
    currentTotal: number;
    currentOutstanding: number;
  };
} => {
  const disbursementDate = disbursedAt ? new Date(disbursedAt) : new Date();
  const today = new Date();
  const daysElapsed = differenceInDays(today, disbursementDate);
  const monthsElapsed = Math.max(0, Math.ceil(daysElapsed / 30));
  
  const schedule = [];
  let remainingBalance = principal;
  
  const monthlyPrincipal = principal / plannedMonths;
  const monthlyInterest = principal * (interestRatePerMonth / 100);
  
  for (let month = 1; month <= plannedMonths; month++) {
    const dueDate = new Date(disbursementDate);
    dueDate.setMonth(dueDate.getMonth() + month);
    
    const cumulativeInterest = monthlyInterest * month;
    remainingBalance = Math.max(0, principal - (monthlyPrincipal * month));
    
    schedule.push({
      month,
      dueDate,
      monthlyPrincipal: Math.round(monthlyPrincipal),
      monthlyInterest: Math.round(monthlyInterest),
      totalMonthly: Math.round(monthlyPrincipal + monthlyInterest),
      cumulativeInterest: Math.round(cumulativeInterest),
      remainingBalance: Math.round(remainingBalance),
    });
  }

  // Current interest based on actual months elapsed
  const currentInterest = principal * (interestRatePerMonth / 100) * monthsElapsed;
  const currentTotal = principal + currentInterest;
  const currentOutstanding = Math.max(0, currentTotal - totalRepaid);

  return {
    schedule,
    summary: {
      monthsElapsed,
      currentInterest: Math.round(currentInterest),
      currentTotal: Math.round(currentTotal),
      currentOutstanding: Math.round(currentOutstanding),
    },
  };
};
