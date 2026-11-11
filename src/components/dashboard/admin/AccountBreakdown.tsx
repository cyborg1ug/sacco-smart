import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface AccountRef { id: string; account_number: string; name: string; type: "main" | "sub" }
interface Tx {
  id: string; account_id: string; origin_account_id: string | null; transaction_type: string;
  amount: number; status: string; created_at: string; description: string | null; tnx_id: string;
}

const CREDIT = ["deposit", "loan_disbursement"];
const DEBIT = ["withdrawal", "loan_repayment"];

/** Splits a consolidated (parent) account into the original accounts each transaction came from. */
export default function AccountBreakdown({ mainAccountId, accounts }: { mainAccountId: string; accounts: AccountRef[] }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<string>("all");

  useEffect(() => {
    const ids = accounts.map(a => a.id);
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("id, account_id, origin_account_id, transaction_type, amount, status, created_at, description, tnx_id")
        .in("account_id", ids)
        .order("created_at", { ascending: true })
        .limit(5000);
      setTxs((data as Tx[]) || []);
      setLoading(false);
    })();
  }, [mainAccountId, accounts]);

  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const originOf = (t: Tx) => t.origin_account_id || t.account_id;

  const stats = useMemo(() => {
    const m: Record<string, { savings: number; cash: number; count: number }> = {};
    accounts.forEach(a => (m[a.id] = { savings: 0, cash: 0, count: 0 }));
    txs.forEach(t => {
      if (t.status !== "approved") return;
      const o = originOf(t);
      if (!m[o]) m[o] = { savings: 0, cash: 0, count: 0 };
      m[o].count++;
      const amt = Number(t.amount);
      if (CREDIT.includes(t.transaction_type)) m[o].cash += amt;
      if (DEBIT.includes(t.transaction_type)) m[o].cash -= amt;
      if (t.transaction_type === "deposit") m[o].savings += amt;
      if (t.transaction_type === "withdrawal" && (t.description || "").toLowerCase().startsWith("admin deduction")) m[o].savings -= amt;
    });
    return m;
  }, [txs, accounts]);

  const rows = useMemo(() => {
    const list = view === "all" ? txs : txs.filter(t => originOf(t) === view);
    let running = 0;
    return list.map(t => {
      if (t.status === "approved") {
        if (CREDIT.includes(t.transaction_type)) running += Number(t.amount);
        if (DEBIT.includes(t.transaction_type)) running -= Number(t.amount);
      }
      return { ...t, running };
    }).reverse();
  }, [txs, view]);

  const total = Object.values(stats).reduce((s, x) => ({ savings: s.savings + x.savings, cash: s.cash + x.cash, count: s.count + x.count }), { savings: 0, cash: 0, count: 0 });
  const label = (id: string) => { const a = byId.get(id); return a ? `${a.name} · ${a.account_number}` : id.slice(0, 8); };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Consolidated &amp; Separate Accounts</CardTitle>
          <CardDescription>See the combined total, or pick one account to see only its own balance and transactions.</CardDescription>
        </div>
        <Select value={view} onValueChange={setView}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts (consolidated)</SelectItem>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.type === "main" ? "Main" : "Sub"}: {a.name} · {a.account_number}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <button onClick={() => setView("all")} className={`text-left rounded-2xl border p-4 ${view === "all" ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between"><span className="font-medium">Consolidated total</span><Badge>All</Badge></div>
                <p className="text-sm text-muted-foreground mt-2">Savings: <span className="font-semibold text-foreground">UGX {total.savings.toLocaleString()}</span></p>
                <p className="text-sm text-muted-foreground">Cash ledger: <span className="font-semibold text-foreground">UGX {total.cash.toLocaleString()}</span></p>
                <p className="text-xs text-muted-foreground">{total.count} transactions</p>
              </button>
              {accounts.map(a => (
                <button key={a.id} onClick={() => setView(a.id)} className={`text-left rounded-2xl border p-4 ${view === a.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center justify-between"><span className="font-medium truncate">{a.name}</span><Badge variant={a.type === "main" ? "default" : "secondary"}>{a.type === "main" ? "Main" : "Sub"}</Badge></div>
                  <p className="text-xs text-muted-foreground">{a.account_number}</p>
                  <p className="text-sm text-muted-foreground mt-2">Savings: <span className="font-semibold text-foreground">UGX {(stats[a.id]?.savings || 0).toLocaleString()}</span></p>
                  <p className="text-sm text-muted-foreground">Cash ledger: <span className="font-semibold text-foreground">UGX {(stats[a.id]?.cash || 0).toLocaleString()}</span></p>
                  <p className="text-xs text-muted-foreground">{stats[a.id]?.count || 0} transactions</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Savings here = deposits − admin deductions (welfare is charged on the consolidated account). Overdue charges after 30 Sep 2026 are not counted.</p>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
                    <TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Running</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(t => (
                    <TableRow key={t.id} className={t.status !== "approved" ? "opacity-50" : ""}>
                      <TableCell className="whitespace-nowrap">{format(new Date(t.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell><Badge variant={byId.get(originOf(t))?.type === "sub" ? "secondary" : "outline"} className="whitespace-nowrap">{label(originOf(t))}</Badge></TableCell>
                      <TableCell className="capitalize whitespace-nowrap">{t.transaction_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{t.description || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(t.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.running.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={t.status === "approved" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
