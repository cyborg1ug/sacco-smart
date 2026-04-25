import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, Download, FileText, Table as TableIcon, FileDown, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { generateBankMemberPDF, generateBankGroupPDF, generateBankTextReport, generateBankExcel } from "@/lib/bankReportGenerator";
import * as XLSX from "xlsx";

interface AIReportInsightsProps {
  members: { id: string; full_name: string; accounts: any[] }[];
}

type ReportScope = "member" | "group" | "audit";
type EntryType =
  | "deposit"
  | "withdrawal"
  | "loan_disbursement"
  | "loan_repayment"
  | "interest_received"
  | "savings"
  | "welfare"
  | "loans_overdue"
  | "loans_active";

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  deposit: "Deposits",
  withdrawal: "Withdrawals",
  loan_disbursement: "Loan Disbursements",
  loan_repayment: "Loan Repayments",
  interest_received: "Interest Received",
  savings: "Weekly Savings",
  welfare: "Welfare Contributions",
  loans_overdue: "Overdue Loans",
  loans_active: "Active Loans Portfolio",
};

export default function AIReportInsights({ members }: AIReportInsightsProps) {
  const { toast } = useToast();
  const [reportType, setReportType]     = useState<ReportScope>("group");
  const [selectedMember, setSelectedMember] = useState("");
  const [reportPeriod, setReportPeriod] = useState("current");
  const [entryType, setEntryType]       = useState<EntryType>("deposit");
  const [streaming, setStreaming]       = useState(false);
  const [aiText, setAiText]             = useState("");
  const [reportData, setReportData]     = useState<any>(null);
  const [loading, setLoading]           = useState(false);

  const getDateRange = () => {
    const now = new Date();
    if (reportPeriod === "current") return { start: startOfMonth(now), end: now };
    if (reportPeriod === "last") { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    if (reportPeriod === "quarter") return { start: subMonths(now, 3), end: now };
    return { start: subMonths(now, 12), end: now };
  };

  const isOverdue = (loan: any) => {
    if (!loan.disbursed_at || !loan.repayment_months) return false;
    const due = new Date(loan.disbursed_at);
    due.setMonth(due.getMonth() + loan.repayment_months);
    return new Date() > due;
  };

  const daysOverdue = (loan: any) => {
    if (!loan.disbursed_at || !loan.repayment_months) return 0;
    const due = new Date(loan.disbursed_at);
    due.setMonth(due.getMonth() + loan.repayment_months);
    return new Date() > due ? differenceInDays(new Date(), due) : 0;
  };

  // ── Fetch data for the selected scope ────────────────────────────────
  const fetchData = async () => {
    const dr = getDateRange();

    if (reportType === "member") {
      if (!selectedMember) { toast({ title: "Select a member", variant: "destructive" }); return null; }

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", selectedMember).single();
      const { data: acc } = await supabase.from("accounts").select("*").eq("user_id", selectedMember).eq("account_type", "main").maybeSingle();
      if (!profile || !acc) return null;

      const [{ data: allTxns }, { data: periodTxns }, { data: loans }, { data: savings }] = await Promise.all([
        supabase.from("transactions").select("*").eq("account_id", acc.id).eq("status", "approved").order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").eq("account_id", acc.id).eq("status", "approved")
          .gte("created_at", dr.start.toISOString()).lte("created_at", dr.end.toISOString()),
        supabase.from("loans").select("*").eq("account_id", acc.id),
        supabase.from("savings").select("*").eq("account_id", acc.id).gte("week_start", dr.start.toISOString()),
      ]);

      const sum = (arr: any[], type: string) => (arr || []).filter(t => t.transaction_type === type && t.status === "approved").reduce((s, t) => s + Number(t.amount), 0);
      const activeLoans = (loans || []).filter(l => ["disbursed","active"].includes(l.status) && l.outstanding_balance > 0);

      const aiPayload = {
        memberName: profile.full_name,
        accountNumber: acc.account_number,
        period: `${format(dr.start, "dd MMM yyyy")} — ${format(dr.end, "dd MMM yyyy")}`,
        generatedAt: format(new Date(), "dd MMM yyyy HH:mm"),
        balance: Number(acc.balance),
        totalSavings: Number(acc.total_savings),
        totalDeposits: sum(allTxns || [], "deposit"),
        totalWithdrawals: sum(allTxns || [], "withdrawal"),
        totalDisbursements: sum(allTxns || [], "loan_disbursement"),
        totalRepayments: sum(allTxns || [], "loan_repayment"),
        totalInterest: sum(allTxns || [], "interest_received"),
        periodDeposits: sum(periodTxns || [], "deposit"),
        periodWithdrawals: sum(periodTxns || [], "withdrawal"),
        periodDisbursements: sum(periodTxns || [], "loan_disbursement"),
        periodRepayments: sum(periodTxns || [], "loan_repayment"),
        activeLoansCount: activeLoans.length,
        completedLoansCount: (loans || []).filter(l => ["completed","fully_paid"].includes(l.status)).length,
        savingsRecords: (savings || []).length,
        periodSavings: (savings || []).reduce((s, sv) => s + Number(sv.amount), 0),
        overdueLoans: activeLoans.filter(l => isOverdue(l)).map(l => ({
          amount: l.amount, outstanding_balance: l.outstanding_balance, daysOverdue: daysOverdue(l),
        })),
      };

      return {
        type: "member",
        aiPayload,
        rawData: { profile, acc, allTxns, periodTxns, loans, savings, dr },
      };
    }

    // Audit by Entry Type
    if (reportType === "audit") {
      const accountsRes = await supabase.from("accounts").select("*");
      const profilesRes = await supabase.from("profiles").select("id, full_name");
      const subProfilesRes = await supabase.from("sub_account_profiles").select("account_id, full_name");
      const auditAccounts = accountsRes.data || [];
      const auditProfiles = profilesRes.data || [];
      const auditSubProfiles = subProfilesRes.data || [];

      const accMap = new Map<string, any>(auditAccounts.map((a: any) => [a.id, a]));
      const getMemberName = (acc: any) => {
        if (!acc) return "Unknown";
        if (acc.account_type === "sub") return auditSubProfiles.find((p: any) => p.account_id === acc.id)?.full_name || "Unknown (Sub)";
        return auditProfiles.find((p: any) => p.id === acc.user_id)?.full_name || "Unknown";
      };

      let records: any[] = [];
      let allTimeRecords: any[] = [];
      let extraMetrics = "";

      if (entryType === "savings") {
        const pSav = (await supabase.from("savings").select("*").gte("week_start", dr.start.toISOString()).lte("week_end", dr.end.toISOString())).data || [];
        const allSav = (await supabase.from("savings").select("*")).data || [];
        records = pSav.map((s: any) => ({
          amount: Number(s.amount), accountId: s.account_id,
          label: `${getMemberName(accMap.get(s.account_id))} — week ${format(new Date(s.week_start), "dd MMM")}`,
          extra: `${format(new Date(s.week_start), "dd MMM")}–${format(new Date(s.week_end), "dd MMM yyyy")}`,
        }));
        allTimeRecords = allSav.map((s: any) => ({ amount: Number(s.amount), accountId: s.account_id }));
      } else if (entryType === "welfare") {
        const pW = (await supabase.from("welfare").select("*").gte("week_date", dr.start.toISOString().slice(0, 10)).lte("week_date", dr.end.toISOString().slice(0, 10))).data || [];
        const allW = (await supabase.from("welfare").select("*")).data || [];
        records = pW.map((w: any) => ({
          amount: Number(w.amount), accountId: w.account_id,
          label: `${getMemberName(accMap.get(w.account_id))} — ${format(new Date(w.week_date), "dd MMM yyyy")}`,
          extra: w.description || "Weekly welfare",
        }));
        allTimeRecords = allW.map((w: any) => ({ amount: Number(w.amount), accountId: w.account_id }));
      } else if (entryType === "loans_active" || entryType === "loans_overdue") {
        const allLoans = (await supabase.from("loans").select("*")).data || [];
        const active = allLoans.filter((l: any) => ["disbursed", "active"].includes(l.status) && Number(l.outstanding_balance) > 0);
        const filtered = entryType === "loans_overdue" ? active.filter((l: any) => isOverdue(l)) : active;
        const inPeriod = filtered.filter((l: any) => {
          if (!l.disbursed_at) return false;
          const t = new Date(l.disbursed_at).getTime();
          return t >= dr.start.getTime() && t <= dr.end.getTime();
        });
        records = inPeriod.map((l: any) => ({
          amount: Number(l.outstanding_balance), accountId: l.account_id,
          label: `${getMemberName(accMap.get(l.account_id))} — Loan UGX ${Number(l.amount).toLocaleString()}`,
          extra: entryType === "loans_overdue"
            ? `${daysOverdue(l)} days overdue, ${l.repayment_months}m term`
            : `${l.repayment_months}m term, ${l.purpose || "no purpose"}`,
        }));
        allTimeRecords = filtered.map((l: any) => ({ amount: Number(l.outstanding_balance), accountId: l.account_id }));

        if (entryType === "loans_overdue") {
          const totalPenalty = filtered.reduce((s: number, l: any) => {
            const days = daysOverdue(l);
            return s + Math.round(Number(l.amount) * (Number(l.interest_rate || 2) / 100 / 30) * days);
          }, 0);
          const avgDays = filtered.length ? Math.round(filtered.reduce((s: number, l: any) => s + daysOverdue(l), 0) / filtered.length) : 0;
          extraMetrics = `- Average Days Overdue: ${avgDays}\n- Estimated Accrued Penalty: UGX ${totalPenalty.toLocaleString()}\n- Loans > 90 days overdue: ${filtered.filter((l: any) => daysOverdue(l) > 90).length}`;
        } else {
          const purposeCounts: Record<string, number> = {};
          filtered.forEach((l: any) => { const p = l.purpose || "Unspecified"; purposeCounts[p] = (purposeCounts[p] || 0) + 1; });
          const purposeBreak = Object.entries(purposeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p, c]) => `  • ${p}: ${c}`).join("\n");
          extraMetrics = `Loan Purpose Distribution:\n${purposeBreak || "  • No purpose data"}`;
        }
      } else {
        const pTxn = (await supabase.from("transactions").select("*").eq("transaction_type", entryType).eq("status", "approved")
          .gte("created_at", dr.start.toISOString()).lte("created_at", dr.end.toISOString())).data || [];
        const allTxn = (await supabase.from("transactions").select("*").eq("transaction_type", entryType).eq("status", "approved")).data || [];
        records = pTxn.map((t: any) => ({
          amount: Number(t.amount), accountId: t.account_id,
          label: `${getMemberName(accMap.get(t.account_id))} — ${format(new Date(t.created_at), "dd MMM yyyy")}`,
          extra: t.tnx_id ? `TNX ${t.tnx_id}` : (t.description || ""),
        }));
        allTimeRecords = allTxn.map((t: any) => ({ amount: Number(t.amount), accountId: t.account_id }));
      }

      const amounts = records.map(r => r.amount).filter(n => !isNaN(n));
      const periodTotal = amounts.reduce((s, n) => s + n, 0);
      const allTimeTotal = allTimeRecords.reduce((s, r) => s + Number(r.amount || 0), 0);
      const uniqueMembersSet = new Set<string>();
      records.forEach(r => { const acc = accMap.get(r.accountId); if (acc) uniqueMembersSet.add(acc.user_id || acc.id); });

      const memberAgg = new Map<string, { name: string; accountNumber: string; count: number; total: number }>();
      records.forEach(r => {
        const acc = accMap.get(r.accountId);
        const name = getMemberName(acc); const accNo = acc?.account_number || "—";
        const key = `${name}|${accNo}`;
        const cur = memberAgg.get(key) || { name, accountNumber: accNo, count: 0, total: 0 };
        cur.count += 1; cur.total += r.amount;
        memberAgg.set(key, cur);
      });
      const memberBreakdown = Array.from(memberAgg.values()).sort((a, b) => b.total - a.total);
      const topRecords = [...records].sort((a, b) => b.amount - a.amount);

      const aiPayload = {
        entryType,
        entryTypeLabel: ENTRY_TYPE_LABELS[entryType],
        period: `${format(dr.start, "dd MMM yyyy")} — ${format(dr.end, "dd MMM yyyy")}`,
        generatedAt: format(new Date(), "dd MMM yyyy HH:mm"),
        recordCount: records.length,
        periodTotal, allTimeCount: allTimeRecords.length, allTimeTotal,
        avgAmount: amounts.length ? Math.round(periodTotal / amounts.length) : 0,
        maxAmount: amounts.length ? Math.max(...amounts) : 0,
        minAmount: amounts.length ? Math.min(...amounts) : 0,
        uniqueMembers: uniqueMembersSet.size,
        topRecords, memberBreakdown, extraMetrics,
      };

      return { type: "audit", aiPayload, rawData: { dr, records, memberBreakdown, topRecords } };
    }

    // ── Group ─────────────────────────────────────────────────────────
    const [{ data: accounts }, { data: profiles }, { data: subProfiles },
           { data: allTxns }, { data: periodTxns }, { data: allLoans }, { data: savings }] = await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("sub_account_profiles").select("*"),
      supabase.from("transactions").select("*").eq("status", "approved"),
      supabase.from("transactions").select("*").eq("status", "approved").gte("created_at", dr.start.toISOString()).lte("created_at", dr.end.toISOString()),
      supabase.from("loans").select("*"),
      supabase.from("savings").select("*").gte("week_start", dr.start.toISOString()),
    ]);

    const mainAccs = (accounts || []).filter(a => a.account_type === "main");
    const subAccs  = (accounts || []).filter(a => a.account_type === "sub");
    const sum = (arr: any[], type: string) => (arr || []).filter(t => t.transaction_type === type).reduce((s, t) => s + Number(t.amount), 0);
    const activeLoans = (allLoans || []).filter(l => ["disbursed","active"].includes(l.status) && l.outstanding_balance > 0);
    const overdueL = activeLoans.filter(l => isOverdue(l));

    const getMemberName = (acc: any) => {
      if (acc.account_type === "sub") return subProfiles?.find(p => p.account_id === acc.id)?.full_name || "Unknown (Sub)";
      return profiles?.find(p => p.id === acc.user_id)?.full_name || "Unknown";
    };

    const aiPayload = {
      period: `${format(dr.start, "dd MMM yyyy")} — ${format(dr.end, "dd MMM yyyy")}`,
      generatedAt: format(new Date(), "dd MMM yyyy HH:mm"),
      totalMembers: (profiles || []).length,
      mainAccounts: mainAccs.length,
      subAccounts: subAccs.length,
      totalBalance: (accounts || []).reduce((s, a) => s + Number(a.balance), 0),
      totalSavings: (accounts || []).reduce((s, a) => s + Number(a.total_savings), 0),
      allTimeDeposits: sum(allTxns || [], "deposit"),
      allTimeWithdrawals: sum(allTxns || [], "withdrawal"),
      allTimeDisbursements: sum(allTxns || [], "loan_disbursement"),
      allTimeRepayments: sum(allTxns || [], "loan_repayment"),
      allTimeInterest: sum(allTxns || [], "interest_received"),
      periodDeposits: sum(periodTxns || [], "deposit"),
      periodWithdrawals: sum(periodTxns || [], "withdrawal"),
      periodDisbursements: sum(periodTxns || [], "loan_disbursement"),
      periodRepayments: sum(periodTxns || [], "loan_repayment"),
      periodInterest: sum(periodTxns || [], "interest_received"),
      activeLoans: activeLoans.length,
      totalOutstanding: activeLoans.reduce((s, l) => s + Number(l.outstanding_balance), 0),
      overdueLoans: overdueL.length,
      totalOverdueBalance: overdueL.reduce((s, l) => s + Number(l.outstanding_balance), 0),
      totalOverduePenalty: overdueL.reduce((s, l) => {
        const days = daysOverdue(l);
        return s + Math.round(Number(l.amount) * (Number(l.interest_rate || 2) / 100 / 30) * days);
      }, 0),
      pendingLoans: (allLoans || []).filter(l => l.status === "pending").length,
      completedLoans: (allLoans || []).filter(l => ["completed","fully_paid"].includes(l.status)).length,
    };

    const membersData = (accounts || []).map(acc => {
      const memberActiveLoans = activeLoans.filter(l => l.account_id === acc.id);
      const overdueLoan = memberActiveLoans.find(l => isOverdue(l));
      return {
        name: getMemberName(acc),
        accountNumber: acc.account_number,
        accountType: acc.account_type,
        balance: Number(acc.balance),
        savings: Number(acc.total_savings),
        activeLoans: memberActiveLoans.length,
        outstandingBalance: memberActiveLoans.reduce((s, l) => s + Number(l.outstanding_balance), 0),
        isOverdue: !!overdueLoan,
        daysOverdue: overdueLoan ? daysOverdue(overdueLoan) : 0,
      };
    });

    return {
      type: "group",
      aiPayload,
      rawData: { accounts, mainAccs, subAccs, profiles, subProfiles, allTxns, periodTxns, allLoans, savings, activeLoans, overdueL, membersData, dr },
    };
  };

  // ── Stream AI Analysis ───────────────────────────────────────────────
  const runAIAnalysis = async () => {
    setStreaming(true);
    setAiText("");
    setReportData(null);
    const data = await fetchData();
    if (!data) { setStreaming(false); return; }
    setReportData(data);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/ai-report-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ reportType: data.type, data: data.aiPayload }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        if (resp.status === 429) toast({ title: "Rate limited", description: err.error, variant: "destructive" });
        else if (resp.status === 402) toast({ title: "Credits exhausted", description: err.error, variant: "destructive" });
        else toast({ title: "AI error", description: err.error, variant: "destructive" });
        setStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const chunk = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (chunk) { full += chunk; setAiText(full); }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e) {
      toast({ title: "Error", description: "AI analysis failed", variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  // ── Download helpers ─────────────────────────────────────────────────
  const downloadPDF = () => {
    if (!reportData) return;
    const d = reportData.rawData;

    if (reportData.type === "member") {
      generateBankMemberPDF({
        memberName: d.profile.full_name, email: d.profile.email,
        phoneNumber: d.profile.phone_number, occupation: d.profile.occupation,
        accountNumber: d.acc.account_number, balance: Number(d.acc.balance),
        totalSavings: Number(d.acc.total_savings), period: d.dr,
        allTxns: d.allTxns || [], periodTxns: d.periodTxns || [],
        loans: d.loans || [], aiAnalysis: aiText || undefined,
      });
    } else {
      const ai = reportData.aiPayload;
      generateBankGroupPDF({
        period: d.dr, totalMembers: ai.totalMembers,
        mainAccounts: d.mainAccs.length, subAccounts: d.subAccs.length,
        totalBalance: ai.totalBalance, totalSavings: ai.totalSavings,
        allTimeDeposits: ai.allTimeDeposits, allTimeWithdrawals: ai.allTimeWithdrawals,
        allTimeDisbursements: ai.allTimeDisbursements, allTimeRepayments: ai.allTimeRepayments,
        allTimeInterest: ai.allTimeInterest, periodDeposits: ai.periodDeposits,
        periodWithdrawals: ai.periodWithdrawals, periodDisbursements: ai.periodDisbursements,
        periodRepayments: ai.periodRepayments, periodInterest: ai.periodInterest,
        activeLoans: ai.activeLoans, totalOutstanding: ai.totalOutstanding,
        overdueLoans: ai.overdueLoans, totalOverdueBalance: ai.totalOverdueBalance,
        totalOverduePenalty: ai.totalOverduePenalty, pendingLoans: ai.pendingLoans,
        completedLoans: ai.completedLoans, members: d.membersData,
        activeLoansData: d.activeLoans, aiAnalysis: aiText || undefined,
      });
    }
    toast({ title: "PDF downloaded" });
  };

  const downloadText = () => {
    if (!reportData) return;
    const ai = reportData.aiPayload;
    const dr = reportData.rawData.dr;
    const periodStr = `${format(dr.start, "dd MMM yyyy")} — ${format(dr.end, "dd MMM yyyy")}`;
    const refNo = `KS-${reportData.type.toUpperCase()}-${format(new Date(), "yyyyMMddHHmm")}`;

    let sections: { heading: string; rows: [string, string][] }[] = [];

    if (reportData.type === "group") {
      sections = [
        { heading: "Organisation Overview", rows: [
          ["Total Members", String(ai.totalMembers)],
          ["Main Accounts", String(ai.mainAccounts)],
          ["Sub-Accounts", String(ai.subAccounts)],
          ["Combined Balance", `UGX ${Number(ai.totalBalance).toLocaleString()}`],
          ["Combined Savings", `UGX ${Number(ai.totalSavings).toLocaleString()}`],
        ]},
        { heading: "All-Time Financial Totals", rows: [
          ["Total Deposits", `UGX ${Number(ai.allTimeDeposits).toLocaleString()}`],
          ["Total Withdrawals", `UGX ${Number(ai.allTimeWithdrawals).toLocaleString()}`],
          ["Loan Disbursements", `UGX ${Number(ai.allTimeDisbursements).toLocaleString()}`],
          ["Loan Repayments", `UGX ${Number(ai.allTimeRepayments).toLocaleString()}`],
          ["Interest Received", `UGX ${Number(ai.allTimeInterest).toLocaleString()}`],
        ]},
        { heading: "Loan Portfolio", rows: [
          ["Active Loans", String(ai.activeLoans)],
          ["Total Outstanding", `UGX ${Number(ai.totalOutstanding).toLocaleString()}`],
          ["Overdue Loans", String(ai.overdueLoans)],
          ["Total Overdue Balance", `UGX ${Number(ai.totalOverdueBalance).toLocaleString()}`],
        ]},
      ];
    } else {
      sections = [
        { heading: "Member Details", rows: [
          ["Account", ai.accountNumber], ["Period", ai.period],
          ["Balance", `UGX ${Number(ai.balance).toLocaleString()}`],
          ["Total Savings", `UGX ${Number(ai.totalSavings).toLocaleString()}`],
        ]},
        { heading: "Financial Summary", rows: [
          ["Total Deposits", `UGX ${Number(ai.totalDeposits).toLocaleString()}`],
          ["Total Withdrawals", `UGX ${Number(ai.totalWithdrawals).toLocaleString()}`],
          ["Active Loans", String(ai.activeLoansCount)],
        ]},
      ];
    }

    const txt = generateBankTextReport({
      type: reportData.type, title: reportData.type === "group" ? "COMPREHENSIVE GROUP FINANCIAL REPORT" : "MEMBER ACCOUNT STATEMENT",
      sections, aiAnalysis: aiText || undefined, refNo, period: periodStr,
    });

    const blob = new Blob([txt], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `KINONI_SACCO_${reportData.type}_report_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Text report downloaded" });
  };

  const downloadExcel = () => {
    if (!reportData) return;
    const ai = reportData.aiPayload;
    const d  = reportData.rawData;

    const sheets = reportData.type === "group"
      ? [
          { name: "Summary", data: [
            ["KINONI SACCO — GROUP FINANCIAL REPORT"],
            [`Period: ${ai.period}`],
            [`Generated: ${ai.generatedAt}`],
            [],
            ["OVERVIEW"],
            ["Total Members", ai.totalMembers],
            ["Combined Balance (UGX)", ai.totalBalance],
            ["Combined Savings (UGX)", ai.totalSavings],
            [],
            ["ALL-TIME TOTALS"],
            ["Total Deposits (UGX)", ai.allTimeDeposits],
            ["Total Withdrawals (UGX)", ai.allTimeWithdrawals],
            ["Net Deposits (UGX)", ai.allTimeDeposits - ai.allTimeWithdrawals],
            ["Loan Disbursements (UGX)", ai.allTimeDisbursements],
            ["Loan Repayments (UGX)", ai.allTimeRepayments],
            ["Interest Income (UGX)", ai.allTimeInterest],
            [],
            ["LOAN PORTFOLIO"],
            ["Active Loans", ai.activeLoans],
            ["Total Outstanding (UGX)", ai.totalOutstanding],
            ["Overdue Loans", ai.overdueLoans],
            ["Total Overdue Balance (UGX)", ai.totalOverdueBalance],
            ["Total Overdue Penalties (UGX)", ai.totalOverduePenalty],
          ]},
          { name: "Members", data: [
            ["Member Name", "Account No.", "Type", "Balance (UGX)", "Savings (UGX)", "Loan Outstanding (UGX)", "Loan Status"],
            ...(d.membersData || []).map((m: any) => [
              m.name, m.accountNumber, m.accountType === "sub" ? "Sub" : "Main",
              m.balance, m.savings, m.outstandingBalance,
              m.isOverdue ? `OVERDUE (${m.daysOverdue} days)` : (m.activeLoans > 0 ? "Active" : "None"),
            ]),
          ]},
          { name: "Loans", data: [
            ["Account ID", "Status", "Principal (UGX)", "Total Payable (UGX)", "Outstanding (UGX)", "Disbursed At", "Repayment Months"],
            ...(d.allLoans || []).map((l: any) => [
              l.account_id, l.status, Number(l.amount), Number(l.total_amount), Number(l.outstanding_balance),
              l.disbursed_at ? format(new Date(l.disbursed_at), "dd MMM yyyy") : "N/A",
              l.repayment_months,
            ]),
          ]},
        ]
      : [
          { name: "Summary", data: [
            ["KINONI SACCO — MEMBER REPORT"],
            [`Account: ${d.acc?.account_number}`],
            [],
            ["Balance (UGX)", Number(d.acc?.balance)],
            ["Total Savings (UGX)", Number(d.acc?.total_savings)],
          ]},
          { name: "Transactions", data: [
            ["Date", "TXN ID", "Type", "Amount (UGX)", "Balance After (UGX)", "Status"],
            ...(d.allTxns || []).map((t: any) => [
              format(new Date(t.created_at), "dd MMM yyyy HH:mm"),
              t.tnx_id, t.transaction_type.replace(/_/g, " ").toUpperCase(),
              Number(t.amount), Number(t.balance_after), t.status?.toUpperCase(),
            ]),
          ]},
          { name: "Loans", data: [
            ["Principal (UGX)", "Rate", "Months", "Total Payable (UGX)", "Outstanding (UGX)", "Status"],
            ...(d.loans || []).map((l: any) => [
              Number(l.amount), `${l.interest_rate}%`, l.repayment_months,
              Number(l.total_amount), Number(l.outstanding_balance), l.status.toUpperCase(),
            ]),
          ]},
        ];

    generateBankExcel({
      type: reportData.type,
      filename: `KINONI_SACCO_${reportData.type}_report_${format(new Date(), "yyyyMMdd")}.xlsx`,
      sheets,
      aiAnalysis: aiText || undefined,
    });
    toast({ title: "Excel report downloaded" });
  };

  const hasResult = !!aiText;

  return (
    <div className="space-y-5">
      {/* Config Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">AI-Enhanced Bank Report</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                AI analyses SACCO data and generates professional bank-format reports with insights, risk flags, and recommendations.
                Export as PDF, Text, or Excel — all with AI narrative included.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Report Scope</label>
              <Select value={reportType} onValueChange={(v) => { setReportType(v as any); setSelectedMember(""); setAiText(""); setReportData(null); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">🏦 Group (All Members)</SelectItem>
                  <SelectItem value="member">👤 Individual Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reportType === "member" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Member</label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select member…" /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <Select value={reportPeriod} onValueChange={setReportPeriod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="last">Last Month</SelectItem>
                  <SelectItem value="quarter">Last 3 Months</SelectItem>
                  <SelectItem value="year">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runAIAnalysis} disabled={streaming} className="gap-2">
              {streaming
                ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing…</>
                : <><Bot className="w-4 h-4" />{hasResult ? "Re-run AI Analysis" : "Run AI Analysis"}</>
              }
            </Button>
            {hasResult && !streaming && (
              <>
                <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-1.5 h-9">
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={downloadText} className="gap-1.5 h-9">
                  <FileText className="w-3.5 h-3.5" /> Text
                </Button>
                <Button variant="outline" size="sm" onClick={downloadExcel} className="gap-1.5 h-9">
                  <TableIcon className="w-3.5 h-3.5" /> Excel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Streaming output */}
      {(streaming || hasResult) && (
        <Card className="border-border/60">
          <CardHeader className="pb-3 flex flex-row items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className={`w-4 h-4 text-primary ${streaming ? "animate-pulse" : ""}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm">AI Financial Analysis</CardTitle>
              <CardDescription className="text-xs">
                {streaming ? "Generating bank-format analysis…" : "Analysis complete — download in any format above"}
              </CardDescription>
            </div>
            {hasResult && !streaming && (
              <Badge variant="outline" className="text-[10px] border-success/40 text-success gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Complete
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-xl border border-border/40 p-4 max-h-[600px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {aiText || <span className="text-muted-foreground animate-pulse">AI is analysing your financial data…</span>}
              {streaming && <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse ml-0.5 align-middle" />}
            </div>
            {hasResult && (
              <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border/40">
                <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                <span>AI analysis is generated by Google Gemini based on KINONI SACCO transaction data. It is for informational and audit purposes only and does not constitute financial advice.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
