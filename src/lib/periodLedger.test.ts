import { describe, it, expect } from "vitest";
import { savingsAsOf, loanOwedAsOf, daysOverdueAsOf, flowsInPeriod } from "./periodLedger";
const txns = [
  { account_id: "A", transaction_type: "deposit", amount: 100000, created_at: "2026-01-10" },
  { account_id: "A", transaction_type: "deposit", amount: 50000, created_at: "2026-05-10" },
  { account_id: "A", loan_id: "L", transaction_type: "loan_repayment", amount: 300000, created_at: "2026-03-01" },
  { account_id: "A", loan_id: "L", transaction_type: "overdue_interest", amount: 2000, created_at: "2026-06-01" },
];
const loan = { id: "L", account_id: "A", amount: 1000000, total_amount: 1020000, status: "active", disbursed_at: "2026-02-01", repayment_months: 1 };
describe("period ledger", () => {
  it("savings exclude deposits after period end", () => { expect(savingsAsOf("A", new Date("2026-03-31"), txns, [])).toBe(100000); });
  it("loan not yet disbursed owes 0", () => { expect(loanOwedAsOf(loan, new Date("2026-01-31"), txns)).toBe(0); });
  it("loan owed as of date ignores later charges", () => { expect(loanOwedAsOf(loan, new Date("2026-04-30"), txns)).toBe(720000); });
  it("overdue days measured at period end", () => { expect(daysOverdueAsOf(loan, new Date("2026-03-11"))).toBe(10); });
  it("flows only inside period", () => { expect(flowsInPeriod(txns, new Date("2026-05-01"), new Date("2026-05-31")).deposit).toBe(50000); });
});
