import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, subMonths, differenceInDays } from "date-fns";
import { Loader2, FileDown, FileSpreadsheet, FileText, Sliders } from "lucide-react";
import { ACTIVE_LOAN_STATUSES } from "@/lib/accountBalance";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type ReportType =
  | "savings_only"
  | "loans_only"
  | "savings_vs_loans"
  | "savings_rankings"
  | "overdue_loans"
  | "repayments"
  | "withdrawals"
  | "interest_penalties"
  | "welfare";

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "savings_only", label: "Savings Only", description: "Every approved deposit recorded in the period" },
  { value: "loans_only", label: "Loans Only", description: "All loan records with interest and repayment progress" },
  { value: "savings_vs_loans", label: "Savings vs Loans", description: "Per-member savings against active loan exposure" },
  { value: "savings_rankings", label: "Savings Rankings", description: "Members ranked by total savings and period deposits" },
  { value: "overdue_loans", label: "Overdue Loans", description: "Loans past their due date with days overdue and arrears" },
  { value: "repayments", label: "Loan Repayments", description: "All repayments received in the period" },
  { value: "withdrawals", label: "Withdrawals", description: "All withdrawals recorded in the period" },
  { value: "interest_penalties", label: "Interest & Penalties", description: "Interest income and overdue penalty charges" },
  { value: "welfare", label: "Welfare Contributions", description: "Weekly welfare deductions per member" },
];

const ugx = (n: number) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

interface ReportResult {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  numericCols: number[];
  summary: { label: string; value: string }[];
}

const CustomReports = () => {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("savings_only");
  const [from, setFrom] = useState(format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const resolveNames = async (accountIds: string[]) => {
    const ids = [...new Set(accountIds.filter(Boolean))];
    const out: Record<string, { name: string; accountNumber: string }> = {};
    if (!ids.length) return out;
    const { data: accounts } = await supabase
      .from("accounts").select("id, account_number, user_id, account_type").in("id", ids);
    const mainUserIds = [...new Set((accounts || []).filter(a => a.account_type === "main").map(a => a.user_id).filter(Boolean))];
    const subIds = (accounts || []).filter(a => a.account_type === "sub").map(a => a.id);
    const [pRes, sRes] = await Promise.all([
      mainUserIds.length ? supabase.from("profiles").select("id, full_name").in("id", mainUserIds) : Promise.resolve({ data: [] as any[] }),
      subIds.length ? supabase.from("sub_account_profiles").select("account_id, full_name").in("account_id", subIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap = new Map((pRes.data || []).map((p: any) => [p.id, p.full_name]));
    const sMap = new Map((sRes.data || []).map((s: any) => [s.account_id, s.full_name]));
    (accounts || []).forEach((a: any) => {
      out[a.id] = {
        name: (a.account_type === "sub" ? sMap.get(a.id) : pMap.get(a.user_id)) || a.account_number,
        accountNumber: a.account_number,
      };
    });
    return out;
  };

  const dueDateOf = (l: any) => {
    if (!l.disbursed_at) return null;
    const d = new Date(l.disbursed_at);
    d.setMonth(d.getMonth() + (Number(l.repayment_months) || 1));
    return d;
  };

  const fetchTxns = async (types: string[]) => {
    const { data } = await supabase
      .from("transactions")
      .select("id, tnx_id, transaction_type, amount, description, status, created_at, account_id")
      .in("transaction_type", types)
      .eq("status", "approved")
      .gte("created_at", new Date(from).toISOString())
      .lte("created_at", new Date(`${to}T23:59:59`).toISOString())
      .order("created_at", { ascending: true })
      .limit(5000);
    return data || [];
  };

  const buildTxnReport = async (
    title: string, types: string[], amountLabel = "Amount",
  ): Promise<ReportResult> => {
    const txns = await fetchTxns(types);
    const names = await resolveNames(txns.map(t => t.account_id));
    const rows = txns.map(t => [
      format(new Date(t.created_at), "dd MMM yyyy"),
      t.tnx_id || t.id.slice(0, 8),
      names[t.account_id]?.name || "Unknown",
      names[t.account_id]?.accountNumber || "—",
      t.transaction_type.replace(/_/g, " "),
      Number(t.amount),
      t.description || "—",
    ]);
    const total = txns.reduce((s, t) => s + Number(t.amount), 0);
    const members = new Set(txns.map(t => t.account_id)).size;
    return {
      title,
      columns: ["Date", "Ref", "Member", "Account", "Type", amountLabel, "Description"],
      numericCols: [5],
      rows,
      summary: [
        { label: "Entries", value: String(rows.length) },
        { label: "Total", value: ugx(total) },
        { label: "Members Involved", value: String(members) },
        { label: "Average Entry", value: ugx(rows.length ? total / rows.length : 0) },
      ],
    };
  };

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      let res: ReportResult;

      if (reportType === "savings_only") {
        res = await buildTxnReport("Savings Report (Deposits)", ["deposit"], "Deposit");
      } else if (reportType === "repayments") {
        res = await buildTxnReport("Loan Repayments Report", ["loan_repayment"], "Repaid");
      } else if (reportType === "withdrawals") {
        res = await buildTxnReport("Withdrawals Report", ["withdrawal"], "Withdrawn");
      } else if (reportType === "interest_penalties") {
        res = await buildTxnReport("Interest & Penalties Report", ["interest_received", "overdue_interest"], "Charged");
      } else if (reportType === "welfare") {
        const { data } = await supabase
          .from("welfare").select("id, account_id, amount, week_date, description")
          .gte("week_date", from).lte("week_date", to)
          .order("week_date", { ascending: true }).limit(5000);
        const w = data || [];
        const names = await resolveNames(w.map(x => x.account_id));
        const total = w.reduce((s, x) => s + Number(x.amount), 0);
        res = {
          title: "Welfare Contributions Report",
          columns: ["Week", "Member", "Account", "Amount", "Description"],
          numericCols: [3],
          rows: w.map(x => [
            format(new Date(x.week_date), "dd MMM yyyy"),
            names[x.account_id]?.name || "Unknown",
            names[x.account_id]?.accountNumber || "—",
            Number(x.amount),
            x.description || "—",
          ]),
          summary: [
            { label: "Entries", value: String(w.length) },
            { label: "Total Welfare", value: ugx(total) },
            { label: "Members", value: String(new Set(w.map(x => x.account_id)).size) },
          ],
        };
      } else if (reportType === "loans_only" || reportType === "overdue_loans") {
        const { data } = await supabase
          .from("loans")
          .select("id, account_id, amount, interest_rate, total_amount, outstanding_balance, status, purpose, disbursed_at, repayment_months, created_at")
          .order("created_at", { ascending: false }).limit(2000);
        let loans = data || [];
        const overdueOnly = reportType === "overdue_loans";
        if (overdueOnly) {
          loans = loans.filter(l => {
            const due = dueDateOf(l);
            return due && new Date() > due && Number(l.outstanding_balance) > 0;
          });
        }
        const names = await resolveNames(loans.map(l => l.account_id));
        const rows = loans.map(l => {
          const due = dueDateOf(l);
          const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
          const progress = Number(l.total_amount) > 0 ? Math.round((repaid / Number(l.total_amount)) * 100) : 0;
          const daysOverdue = due && new Date() > due ? differenceInDays(new Date(), due) : 0;
          return [
            names[l.account_id]?.name || "Unknown",
            names[l.account_id]?.accountNumber || "—",
            Number(l.amount),
            `${Number(l.interest_rate)}%/mo`,
            Number(l.total_amount),
            Number(l.outstanding_balance),
            `${progress}%`,
            l.disbursed_at ? format(new Date(l.disbursed_at), "dd MMM yyyy") : "—",
            due ? format(due, "dd MMM yyyy") : "—",
            daysOverdue ? `${daysOverdue}d` : "—",
            l.status,
          ];
        });
        const principal = loans.reduce((s, l) => s + Number(l.amount), 0);
        const outstanding = loans.reduce((s, l) => s + Number(l.outstanding_balance), 0);
        const collected = loans.reduce((s, l) => s + (Number(l.total_amount) - Number(l.outstanding_balance)), 0);
        res = {
          title: overdueOnly ? "Overdue Loans Report" : "Loans Report",
          columns: ["Member", "Account", "Principal", "Rate", "Total Due", "Outstanding", "Progress", "Disbursed", "Due Date", "Overdue", "Status"],
          numericCols: [2, 4, 5],
          rows,
          summary: [
            { label: overdueOnly ? "Overdue Loans" : "Loans", value: String(loans.length) },
            { label: "Total Principal", value: ugx(principal) },
            { label: "Outstanding", value: ugx(outstanding) },
            { label: "Repaid To Date", value: ugx(collected) },
          ],
        };
      } else {
        // savings_vs_loans and savings_rankings — per member positions
        const [{ data: accounts }, { data: loans }] = await Promise.all([
          supabase.from("accounts").select("id, account_number, user_id, account_type, total_savings"),
          supabase.from("loans").select("account_id, amount, outstanding_balance, status").in("status", ACTIVE_LOAN_STATUSES),
        ]);
        const accs = accounts || [];
        const names = await resolveNames(accs.map(a => a.id));
        const outstandingByAcc = new Map<string, number>();
        (loans || []).forEach(l => {
          outstandingByAcc.set(l.account_id, (outstandingByAcc.get(l.account_id) || 0) + Number(l.outstanding_balance));
        });
        const periodDeposits = new Map<string, number>();
        (await fetchTxns(["deposit"])).forEach(t => {
          periodDeposits.set(t.account_id, (periodDeposits.get(t.account_id) || 0) + Number(t.amount));
        });

        const enriched = accs.map(a => {
          const savings = Number(a.total_savings || 0);
          const owed = outstandingByAcc.get(a.id) || 0;
          return {
            name: names[a.id]?.name || a.account_number,
            accountNumber: a.account_number,
            savings,
            owed,
            net: savings - owed,
            deposits: periodDeposits.get(a.id) || 0,
          };
        });

        if (reportType === "savings_rankings") {
          const ranked = [...enriched].sort((a, b) => b.savings - a.savings);
          res = {
            title: "Savings Rankings Report",
            columns: ["Rank", "Member", "Account", "Total Savings", "Deposits in Period", "Share of Group"],
            numericCols: [3, 4],
            rows: (() => {
              const total = ranked.reduce((s, m) => s + m.savings, 0) || 1;
              return ranked.map((m, i) => [
                i + 1, m.name, m.accountNumber, m.savings, m.deposits,
                `${((m.savings / total) * 100).toFixed(1)}%`,
              ]);
            })(),
            summary: [
              { label: "Members", value: String(ranked.length) },
              { label: "Combined Savings", value: ugx(ranked.reduce((s, m) => s + m.savings, 0)) },
              { label: "Top Saver", value: ranked[0] ? `${ranked[0].name} — ${ugx(ranked[0].savings)}` : "—" },
              { label: "Deposits in Period", value: ugx(ranked.reduce((s, m) => s + m.deposits, 0)) },
            ],
          };
        } else {
          const list = [...enriched].sort((a, b) => b.owed - a.owed || b.savings - a.savings);
          const totalSavings = list.reduce((s, m) => s + m.savings, 0);
          const totalOwed = list.reduce((s, m) => s + m.owed, 0);
          res = {
            title: "Savings vs Loans Report",
            columns: ["Member", "Account", "Total Savings", "Active Loan Outstanding", "Net Position", "Exposure Ratio"],
            numericCols: [2, 3, 4],
            rows: list.map(m => [
              m.name, m.accountNumber, m.savings, m.owed, m.net,
              m.savings > 0 ? `${((m.owed / m.savings) * 100).toFixed(0)}%` : m.owed > 0 ? "No savings" : "0%",
            ]),
            summary: [
              { label: "Members", value: String(list.length) },
              { label: "Combined Savings", value: ugx(totalSavings) },
              { label: "Loan Exposure", value: ugx(totalOwed) },
              { label: "Group Net Position", value: ugx(totalSavings - totalOwed) },
            ],
          };
        }
      }

      setResult(res);
      toast({ title: "Report ready", description: `${res.rows.length} record(s) compiled from live data` });
    } catch (e: any) {
      toast({ title: "Failed to generate report", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const periodText = `${format(new Date(from), "dd MMM yyyy")} – ${format(new Date(to), "dd MMM yyyy")}`;

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF({ orientation: result.columns.length > 7 ? "landscape" : "portrait" });
    doc.setFontSize(15);
    doc.text("KINONI SACCO", 14, 15);
    doc.setFontSize(11);
    doc.text(result.title, 14, 22);
    doc.setFontSize(9);
    doc.text(`Period: ${periodText}`, 14, 28);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 33);
    autoTable(doc, {
      startY: 38,
      head: [["Metric", "Value"]],
      body: result.summary.map(s => [s.label, s.value]),
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [23, 37, 84] },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [result.columns],
      body: result.rows.map(r => r.map((c, i) => (result.numericCols.includes(i) ? ugx(Number(c)) : String(c)))),
      theme: "striped",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [23, 37, 84] },
    });
    doc.save(`${result.title.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const exportExcel = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["KINONI SACCO"], [result.title], [`Period: ${periodText}`], [],
      ...result.summary.map(s => [s.label, s.value]), [],
      result.columns, ...result.rows,
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Report");
    XLSX.writeFile(wb, `${result.title.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const exportCSV = () => {
    if (!result) return;
    const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [result.columns.map(esc).join(","), ...result.rows.map(r => r.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeType = REPORT_TYPES.find(r => r.value === reportType)!;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Custom Reports
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Build a report from any entry type — savings, loans, rankings, overdue exposure and more, straight from transaction records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Report Type</Label>
              <Select value={reportType} onValueChange={(v) => { setReportType(v as ReportType); setResult(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{activeType.description}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate Report
            </Button>
            <Button variant="outline" onClick={exportPDF} disabled={!result} className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={!result} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={!result} className="gap-2">
              <FileDown className="w-4 h-4" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{result.title}</CardTitle>
            <CardDescription className="text-xs">{periodText} · {result.rows.length} record(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {result.summary.map(s => (
                <div key={s.label} className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
                  <p className="text-sm font-bold tabular-nums mt-1 break-words">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((c, i) => (
                      <TableHead key={c} className={`text-xs whitespace-nowrap ${result.numericCols.includes(i) ? "text-right" : ""}`}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((r, ri) => (
                    <TableRow key={ri}>
                      {r.map((c, ci) => (
                        <TableCell key={ci} className={`text-xs whitespace-nowrap ${result.numericCols.includes(ci) ? "text-right tabular-nums" : ""}`}>
                          {result.numericCols.includes(ci) ? ugx(Number(c)) : String(c)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {result.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={result.columns.length} className="text-center text-xs text-muted-foreground py-6">
                        No records found for this selection
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomReports;
