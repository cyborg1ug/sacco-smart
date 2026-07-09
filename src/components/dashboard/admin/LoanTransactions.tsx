import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, ArrowDownRight, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { MobileCardList, MobileCard } from "@/components/ui/MobileCardList";

interface LoanTxn {
  id: string;
  tnx_id: string | null;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  description: string | null;
  loan_id: string | null;
  account_id: string;
  memberName: string;
  accountNumber: string;
}

const LOAN_TYPES = ["loan_disbursement", "loan_repayment", "interest_received", "overdue_interest"];

const typeMeta: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  loan_disbursement: { label: "Disbursement", icon: ArrowDownRight, color: "text-warning", bg: "bg-warning/10" },
  loan_repayment: { label: "Repayment", icon: RefreshCw, color: "text-info", bg: "bg-info/10" },
  interest_received: { label: "Interest", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
  overdue_interest: { label: "Overdue Penalty", icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
};

const statusVariant = (s: string) =>
  s === "approved" ? "default" : s === "pending" ? "outline" : "destructive";

const LoanTransactions = () => {
  const [txns, setTxns] = useState<LoanTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
    const channel = supabase
      .channel("loan-transactions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("id, tnx_id, transaction_type, amount, status, created_at, description, loan_id, account_id")
      .in("transaction_type", LOAN_TYPES)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (!data) { setLoading(false); return; }

    const accountIds = [...new Set(data.map((t) => t.account_id))];
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type")
      .in("id", accountIds);

    const mainUserIds = [...new Set((accounts || []).filter((a) => a.account_type === "main").map((a) => a.user_id))];
    const subIds = (accounts || []).filter((a) => a.account_type === "sub").map((a) => a.id);

    const [pRes, sRes] = await Promise.all([
      mainUserIds.length ? supabase.from("profiles").select("id, full_name").in("id", mainUserIds) : Promise.resolve({ data: [] as any[] }),
      subIds.length ? supabase.from("sub_account_profiles").select("account_id, full_name").in("account_id", subIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pMap = new Map((pRes.data || []).map((p: any) => [p.id, p.full_name]));
    const sMap = new Map((sRes.data || []).map((s: any) => [s.account_id, s.full_name]));
    const accMap = new Map((accounts || []).map((a) => [a.id, a]));

    const enriched: LoanTxn[] = data.map((t) => {
      const acc: any = accMap.get(t.account_id);
      const name = acc
        ? acc.account_type === "sub"
          ? (sMap.get(acc.id) || acc.account_number)
          : (pMap.get(acc.user_id) || acc.account_number)
        : "Unknown";
      return { ...t, memberName: name, accountNumber: acc?.account_number || "—" } as LoanTxn;
    });

    setTxns(enriched);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (typeFilter !== "all" && t.transaction_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.memberName.toLowerCase().includes(q) ||
          (t.tnx_id || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [txns, typeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: txns.length };
    LOAN_TYPES.forEach((tp) => { c[tp] = txns.filter((t) => t.transaction_type === tp).length; });
    return c;
  }, [txns]);

  const renderTable = () => (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Member</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="hidden md:table-cell">Description</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((t) => {
            const meta = typeMeta[t.transaction_type];
            const Icon = meta?.icon || RefreshCw;
            return (
              <TableRow key={t.id}>
                <TableCell className="text-[10px] sm:text-xs font-mono text-muted-foreground">{t.tnx_id || t.id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs sm:text-sm font-medium">{t.memberName}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium ${meta?.color}`}>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center ${meta?.bg}`}><Icon className="w-3 h-3" /></span>
                    {meta?.label || t.transaction_type}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-[10px] sm:text-xs font-medium">UGX {Number(t.amount).toLocaleString()}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[220px] truncate">{t.description || "—"}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs whitespace-nowrap">{format(new Date(t.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell><Badge variant={statusVariant(t.status)} className="text-[8px] sm:text-[10px] capitalize">{t.status}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderMobileCard = (t: LoanTxn) => {
    const meta = typeMeta[t.transaction_type];
    return (
      <MobileCard
        key={t.id}
        fields={[
          { label: "Ref", value: t.tnx_id || t.id.slice(0, 8) },
          { label: "Member", value: t.memberName },
          { label: "Type", value: meta?.label || t.transaction_type },
          { label: "Amount", value: `UGX ${Number(t.amount).toLocaleString()}` },
          { label: "Date", value: format(new Date(t.created_at), "dd MMM yyyy") },
        ]}
        status={{ label: t.status, variant: statusVariant(t.status) }}
      />
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg md:text-xl">Loan Transactions</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          All loan-related records — disbursements, repayments, interest and penalties recorded by admins
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
        <div className="pb-3">
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50 rounded-lg w-full justify-start">
              <TabsTrigger value="all" className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">All ({counts.all})</TabsTrigger>
              {LOAN_TYPES.map((tp) => (
                <TabsTrigger key={tp} value={tp} className="text-[10px] sm:text-xs px-2 sm:px-3 h-7 sm:h-8 data-[state=active]:bg-background">
                  {typeMeta[tp].label} ({counts[tp] || 0})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="pb-4 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by member, ref or description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} records</span>
        </div>
        <MobileCardList
          items={filtered}
          renderCard={renderMobileCard}
          renderTable={renderTable}
          emptyMessage="No loan transactions found"
        />
      </CardContent>
    </Card>
  );
};

export default LoanTransactions;
