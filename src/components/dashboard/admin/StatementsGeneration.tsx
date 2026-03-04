import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Loader2, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

const StatementsGeneration = () => {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");

  const loadMembers = async () => {
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("id, account_number, user_id, account_type")
      .eq("account_type", "main");

    if (accountsData && accountsData.length > 0) {
      const userIds = [...new Set(accountsData.map((a: any) => a.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const accountsMap = new Map<string, any[]>();
      accountsData.forEach((acc: any) => {
        if (!accountsMap.has(acc.user_id)) accountsMap.set(acc.user_id, []);
        accountsMap.get(acc.user_id)!.push(acc);
      });

      const membersWithAccounts = profilesData?.map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        accounts: accountsMap.get(profile.id) || [],
      })) || [];
      setMembers(membersWithAccounts);
    }
  };

  const fetchMemberData = async (profileId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone_number, occupation, address, national_id")
      .eq("id", profileId)
      .single();
    if (!profile) return null;

    const { data: account } = await supabase
      .from("accounts")
      .select("id, account_number, balance, total_savings")
      .eq("user_id", profileId)
      .eq("account_type", "main")
      .maybeSingle();
    if (!account) return null;

    const [{ data: transactions }, { data: loans }, { data: savings }, { data: welfare }] = await Promise.all([
      supabase.from("transactions").select("*").eq("account_id", account.id).order("created_at", { ascending: false }),
      supabase.from("loans").select("*").eq("account_id", account.id).order("created_at", { ascending: false }),
      supabase.from("savings").select("*").eq("account_id", account.id).order("week_start", { ascending: false }),
      supabase.from("welfare").select("*").eq("account_id", account.id).order("week_date", { ascending: false }),
    ]);

    return { profile, account, transactions, loans, savings, welfare };
  };

  const generateMemberStatement = async (asExcel = false) => {
    if (!selectedMember) {
      toast({ title: "Error", description: "Please select a member", variant: "destructive" });
      return;
    }
    setLoading(true);
    const data = await fetchMemberData(selectedMember);
    if (!data) {
      toast({ title: "Error", description: "Member not found", variant: "destructive" });
      setLoading(false);
      return;
    }
    const { profile, account, transactions, loans, savings, welfare } = data;

    if (asExcel) {
      const wb = XLSX.utils.book_new();

      // ── Summary Sheet
      const txnTypes = ["deposit", "withdrawal", "loan_disbursement", "loan_repayment", "interest_received"];
      const totals: Record<string, number> = {};
      txnTypes.forEach(type => {
        totals[type] = (transactions || [])
          .filter((t: any) => t.transaction_type === type && t.status === "approved")
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
      });

      const summaryRows = [
        ["KINONI SACCO - MEMBER STATEMENT"],
        [`Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}`],
        [],
        ["MEMBER INFORMATION"],
        ["Full Name", profile.full_name],
        ["Email", profile.email],
        ["Phone", profile.phone_number || "N/A"],
        ["National ID", profile.national_id || "N/A"],
        ["Occupation", profile.occupation || "N/A"],
        ["Address", profile.address || "N/A"],
        ["Account Number", account.account_number],
        [],
        ["ACCOUNT BALANCES"],
        ["Current Balance (UGX)", Number(account.balance)],
        ["Total Savings All-time (UGX)", Number(account.total_savings)],
        [],
        ["ALL-TIME TRANSACTION TOTALS"],
        ...txnTypes.map(type => [type.replace(/_/g, " ").toUpperCase() + " (UGX)", totals[type]]),
        [],
        ["WELFARE TOTAL (UGX)", (welfare || []).reduce((s: number, w: any) => s + Number(w.amount), 0)],
        ["SAVINGS TOTAL (UGX)", (savings || []).reduce((s: number, sv: any) => s + Number(sv.amount), 0)],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

      // ── Transactions Sheet — every row has its own balance_after
      const txnHeaders = ["Date", "TXN ID", "Type", "Amount (UGX)", "Balance After (UGX)", "Status", "Description"];
      const txnRows = (transactions || []).map((t: any) => [
        format(new Date(t.created_at), "MMM dd, yyyy HH:mm"),
        t.tnx_id || "",
        t.transaction_type.replace(/_/g, " ").toUpperCase(),
        Number(t.amount),
        Number(t.balance_after),
        (t.status || "").toUpperCase(),
        t.description || "",
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([txnHeaders, ...txnRows]), "Transactions");

      // ── Loans Sheet
      const loanHeaders = ["Applied On", "Principal (UGX)", "Rate (%/mo)", "Months", "Total Interest (UGX)", "Total Payable (UGX)", "Amount Repaid (UGX)", "Outstanding (UGX)", "Status", "Disbursed On", "Due Date"];
      const loanRows = (loans || []).map((l: any) => {
        const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
        const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
        const dueDate = l.disbursed_at && l.repayment_months
          ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy")
          : "N/A";
        return [
          format(new Date(l.created_at), "MMM dd, yyyy"),
          Number(l.amount), l.interest_rate, l.repayment_months,
          totalInterest, Number(l.total_amount), repaid, Number(l.outstanding_balance),
          l.status.toUpperCase(),
          l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A",
          dueDate,
        ];
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([loanHeaders, ...loanRows]), "Loans");

      // ── Savings Sheet
      const savingsHeaders = ["Week Start", "Week End", "Amount (UGX)"];
      const savingsRows = (savings || []).map((s: any) => [
        format(new Date(s.week_start), "MMM dd, yyyy"),
        format(new Date(s.week_end), "MMM dd, yyyy"),
        Number(s.amount),
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([savingsHeaders, ...savingsRows]), "Savings");

      // ── Welfare Sheet
      const welfareHeaders = ["Week Date", "Amount (UGX)", "Description"];
      const welfareRows = (welfare || []).map((w: any) => [
        format(new Date(w.week_date), "MMM dd, yyyy"),
        Number(w.amount),
        w.description || "Weekly welfare deduction",
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([welfareHeaders, ...welfareRows]), "Welfare");

      XLSX.writeFile(wb, `statement_${account.account_number}_${format(new Date(), "yyyyMMdd")}.xlsx`);
      toast({ title: "Success", description: "Excel statement downloaded" });
      setLoading(false);
      return;
    }

    // ── Text Statement
    const totalDeposits = (transactions || []).filter((t: any) => t.transaction_type === "deposit" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalWithdrawals = (transactions || []).filter((t: any) => t.transaction_type === "withdrawal" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalRepayments = (transactions || []).filter((t: any) => t.transaction_type === "loan_repayment" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalDisbursements = (transactions || []).filter((t: any) => t.transaction_type === "loan_disbursement" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalInterest = (transactions || []).filter((t: any) => t.transaction_type === "interest_received" && t.status === "approved").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalWelfare = (welfare || []).reduce((s: number, w: any) => s + Number(w.amount), 0);
    const totalSavingsContributed = (savings || []).reduce((s: number, sv: any) => s + Number(sv.amount), 0);

    let statement = `KINONI SACCO - DETAILED MEMBER STATEMENT\n`;
    statement += `${"═".repeat(80)}\n`;
    statement += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n\n`;

    statement += `MEMBER INFORMATION\n${"─".repeat(80)}\n`;
    statement += `Full Name:        ${profile.full_name}\n`;
    statement += `Email:            ${profile.email}\n`;
    statement += `Phone:            ${profile.phone_number || "N/A"}\n`;
    statement += `National ID:      ${profile.national_id || "N/A"}\n`;
    statement += `Occupation:       ${profile.occupation || "N/A"}\n`;
    statement += `Address:          ${profile.address || "N/A"}\n`;
    statement += `Account Number:   ${account.account_number}\n\n`;

    statement += `ACCOUNT BALANCES\n${"─".repeat(80)}\n`;
    statement += `Current Balance:                UGX ${Number(account.balance).toLocaleString()}\n`;
    statement += `Total Savings (all-time):       UGX ${Number(account.total_savings).toLocaleString()}\n\n`;

    statement += `ALL-TIME TRANSACTION TOTALS\n${"─".repeat(80)}\n`;
    statement += `Total Deposits:                 UGX ${totalDeposits.toLocaleString()}\n`;
    statement += `Total Withdrawals:              UGX ${totalWithdrawals.toLocaleString()}\n`;
    statement += `Net Deposits:                   UGX ${(totalDeposits - totalWithdrawals).toLocaleString()}\n`;
    statement += `Total Loan Disbursements:       UGX ${totalDisbursements.toLocaleString()}\n`;
    statement += `Total Loan Repayments:          UGX ${totalRepayments.toLocaleString()}\n`;
    statement += `Total Interest Paid:            UGX ${totalInterest.toLocaleString()}\n`;
    statement += `Total Welfare Deductions:       UGX ${totalWelfare.toLocaleString()}\n`;
    statement += `Total Weekly Savings:           UGX ${totalSavingsContributed.toLocaleString()}\n\n`;

    statement += `TRANSACTION HISTORY (${transactions?.length || 0} records)\n${"─".repeat(80)}\n`;
    statement += `${"Date & Time".padEnd(20)} | ${"TXN ID".padEnd(10)} | ${"Type".padEnd(20)} | ${"Amount".padStart(14)} | ${"Bal After".padStart(14)} | Status\n`;
    statement += `${"-".repeat(90)}\n`;
    (transactions || []).forEach((t: any) => {
      const dateTime = format(new Date(t.created_at), "MMM dd, yyyy HH:mm");
      const type = t.transaction_type.replace(/_/g, " ").toUpperCase();
      statement += `${dateTime.padEnd(20)} | ${(t.tnx_id || "-").padEnd(10)} | ${type.padEnd(20)} | ${"UGX " + Number(t.amount).toLocaleString().padStart(10)} | ${"UGX " + Number(t.balance_after).toLocaleString().padStart(10)} | ${(t.status || "").toUpperCase()}\n`;
      if (t.description) statement += `  └─ ${t.description}\n`;
    });

    statement += `\nLOAN HISTORY (${loans?.length || 0} records)\n${"─".repeat(80)}\n`;
    (loans || []).forEach((l: any, i: number) => {
      const totalInterestCalc = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
      const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
      const dueDate = l.disbursed_at && l.repayment_months
        ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy")
        : "N/A";
      statement += `Loan ${i + 1} — Applied: ${format(new Date(l.created_at), "MMM dd, yyyy")}\n`;
      statement += `  Principal:        UGX ${Number(l.amount).toLocaleString()}\n`;
      statement += `  Interest Rate:    ${l.interest_rate}% per month × ${l.repayment_months} months\n`;
      statement += `  Total Interest:   UGX ${totalInterestCalc.toLocaleString()}\n`;
      statement += `  Total Payable:    UGX ${Number(l.total_amount).toLocaleString()}\n`;
      statement += `  Amount Repaid:    UGX ${repaid.toLocaleString()}\n`;
      statement += `  Outstanding:      UGX ${Number(l.outstanding_balance).toLocaleString()}\n`;
      statement += `  Status:           ${l.status.toUpperCase()}\n`;
      if (l.disbursed_at) statement += `  Disbursed:        ${format(new Date(l.disbursed_at), "MMM dd, yyyy")}\n`;
      statement += `  Due Date:         ${dueDate}\n\n`;
    });

    statement += `WELFARE RECORDS (${welfare?.length || 0} entries)\n${"─".repeat(80)}\n`;
    (welfare || []).forEach((w: any) => {
      statement += `${format(new Date(w.week_date), "MMM dd, yyyy")} | UGX ${Number(w.amount).toLocaleString().padStart(8)} | ${w.description || "Weekly welfare"}\n`;
    });
    if (!welfare || welfare.length === 0) statement += `No welfare entries recorded.\n`;

    statement += `\nWEEKLY SAVINGS (${savings?.length || 0} entries)\n${"─".repeat(80)}\n`;
    (savings || []).forEach((s: any) => {
      statement += `${format(new Date(s.week_start), "MMM dd, yyyy")} – ${format(new Date(s.week_end), "MMM dd, yyyy")} | UGX ${Number(s.amount).toLocaleString()}\n`;
    });
    if (!savings || savings.length === 0) statement += `No savings entries recorded.\n`;

    statement += `\n${"═".repeat(80)}\nEnd of Statement - KINONI SACCO Management System\n`;

    const blob = new Blob([statement], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement_${account.account_number}_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Statement generated successfully" });
    setLoading(false);
  };

  const generateGroupStatement = async (asExcel = false) => {
    setLoading(true);

    const { data: accounts } = await supabase.from("accounts").select("*");
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: subProfiles } = await supabase.from("sub_account_profiles").select("*");
    const { data: transactions } = await supabase.from("transactions").select("*").eq("status", "approved").order("created_at", { ascending: false });
    const { data: loans } = await supabase.from("loans").select("*");
    const { data: welfare } = await supabase.from("welfare").select("*");

    const getMemberName = (acc: any) => {
      if (acc.account_type === "sub") {
        const sp = subProfiles?.find((p: any) => p.account_id === acc.id);
        return sp?.full_name ? `${sp.full_name} (Sub)` : "Unknown (Sub)";
      }
      const pr = profiles?.find((p: any) => p.id === acc.user_id);
      return pr?.full_name || "Unknown";
    };

    if (asExcel) {
      const wb = XLSX.utils.book_new();

      // Members sheet — individual balances, no combined totals
      const memberHeaders = ["Member Name", "Account Number", "Type", "Balance (UGX)", "Total Savings (UGX)", "Active Loan Outstanding (UGX)"];
      const memberRows = (accounts || []).map((acc: any) => {
        const activeLoans = (loans || []).filter((l: any) => l.account_id === acc.id && ["disbursed", "active"].includes(l.status) && l.outstanding_balance > 0);
        const outstandingBalance = activeLoans.reduce((s: number, l: any) => s + Number(l.outstanding_balance), 0);
        return [
          getMemberName(acc),
          acc.account_number,
          acc.account_type.toUpperCase(),
          Number(acc.balance),
          Number(acc.total_savings),
          outstandingBalance || "",
        ];
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([memberHeaders, ...memberRows]), "Accounts");

      // All Transactions — each row includes balance_after (distinctive per entry)
      const txnHeaders = ["Date", "Member", "Account No.", "TXN ID", "Type", "Amount (UGX)", "Balance After (UGX)", "Status", "Description"];
      const txnRows = (transactions || []).map((t: any) => {
        const acc = (accounts || []).find((a: any) => a.id === t.account_id);
        return [
          format(new Date(t.created_at), "MMM dd, yyyy HH:mm"),
          acc ? getMemberName(acc) : "Unknown",
          acc?.account_number || "",
          t.tnx_id || "",
          t.transaction_type.replace(/_/g, " ").toUpperCase(),
          Number(t.amount),
          Number(t.balance_after),
          (t.status || "").toUpperCase(),
          t.description || "",
        ];
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([txnHeaders, ...txnRows]), "All Transactions");

      // Loans sheet
      const loanHeaders = ["Member", "Account No.", "Principal (UGX)", "Rate", "Months", "Total Interest (UGX)", "Total Payable (UGX)", "Repaid (UGX)", "Outstanding (UGX)", "Status", "Disbursed On", "Due Date"];
      const loanRows = (loans || []).map((l: any) => {
        const acc = (accounts || []).find((a: any) => a.id === l.account_id);
        const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
        const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
        const dueDate = l.disbursed_at && l.repayment_months
          ? format(new Date(new Date(l.disbursed_at).setMonth(new Date(l.disbursed_at).getMonth() + l.repayment_months)), "MMM dd, yyyy")
          : "N/A";
        return [
          acc ? getMemberName(acc) : "Unknown",
          acc?.account_number || "",
          Number(l.amount), `${l.interest_rate}%`, l.repayment_months,
          totalInterest, Number(l.total_amount), repaid, Number(l.outstanding_balance),
          l.status.toUpperCase(),
          l.disbursed_at ? format(new Date(l.disbursed_at), "MMM dd, yyyy") : "N/A",
          dueDate,
        ];
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([loanHeaders, ...loanRows]), "Loans");

      // Welfare sheet
      const welfareHeaders = ["Date", "Member", "Account No.", "Amount (UGX)", "Description"];
      const welfareRows = (welfare || []).map((w: any) => {
        const acc = (accounts || []).find((a: any) => a.id === w.account_id);
        return [
          format(new Date(w.week_date), "MMM dd, yyyy"),
          acc ? getMemberName(acc) : "Unknown",
          acc?.account_number || "",
          Number(w.amount),
          w.description || "Weekly welfare",
        ];
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([welfareHeaders, ...welfareRows]), "Welfare");

      XLSX.writeFile(wb, `group_statement_${format(new Date(), "yyyyMMdd")}.xlsx`);
      toast({ title: "Success", description: "Excel group statement downloaded" });
      setLoading(false);
      return;
    }

    // Text Group Statement
    let statement = `KINONI SACCO - GROUP STATEMENT\n`;
    statement += `Generated: ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}\n`;
    statement += `${"═".repeat(90)}\n\n`;

    statement += `INDIVIDUAL ACCOUNT BALANCES (${(accounts || []).length} accounts)\n${"─".repeat(90)}\n`;
    statement += `${"Member Name".padEnd(30)} | ${"Account No.".padEnd(18)} | ${"Type".padEnd(6)} | ${"Balance (UGX)".padStart(16)} | ${"Savings (UGX)".padStart(16)}\n`;
    statement += `${"-".repeat(90)}\n`;
    (accounts || []).forEach((acc: any) => {
      statement += `${getMemberName(acc).padEnd(30)} | ${acc.account_number.padEnd(18)} | ${acc.account_type.padEnd(6)} | ${Number(acc.balance).toLocaleString().padStart(16)} | ${Number(acc.total_savings).toLocaleString().padStart(16)}\n`;
    });

    statement += `\nALL TRANSACTIONS (approved only, ${transactions?.length || 0} records)\n${"─".repeat(90)}\n`;
    statement += `${"Date".padEnd(18)} | ${"Member".padEnd(22)} | ${"Type".padEnd(22)} | ${"Amount".padStart(14)} | ${"Bal After".padStart(14)} | Status\n`;
    statement += `${"-".repeat(100)}\n`;
    (transactions || []).forEach((t: any) => {
      const acc = (accounts || []).find((a: any) => a.id === t.account_id);
      const memberName = acc ? getMemberName(acc) : "Unknown";
      statement += `${format(new Date(t.created_at), "MMM dd, yyyy HH:mm").padEnd(18)} | ${memberName.padEnd(22)} | ${t.transaction_type.replace(/_/g, " ").toUpperCase().padEnd(22)} | ${"UGX " + Number(t.amount).toLocaleString().padStart(10)} | ${"UGX " + Number(t.balance_after).toLocaleString().padStart(10)} | ${(t.status || "").toUpperCase()}\n`;
    });

    statement += `\nLOAN HISTORY (${loans?.length || 0} records)\n${"─".repeat(90)}\n`;
    (loans || []).forEach((l: any) => {
      const acc = (accounts || []).find((a: any) => a.id === l.account_id);
      const totalInterest = Number(l.amount) * (Number(l.interest_rate) / 100) * (l.repayment_months || 1);
      const repaid = Number(l.total_amount) - Number(l.outstanding_balance);
      statement += `${acc ? getMemberName(acc) : "Unknown"} (${acc?.account_number || "N/A"}) — ${l.status.toUpperCase()}\n`;
      statement += `  Principal: UGX ${Number(l.amount).toLocaleString()} | Interest: UGX ${totalInterest.toLocaleString()} | Total: UGX ${Number(l.total_amount).toLocaleString()}\n`;
      statement += `  Repaid: UGX ${repaid.toLocaleString()} | Outstanding: UGX ${Number(l.outstanding_balance).toLocaleString()}\n\n`;
    });

    statement += `${"═".repeat(90)}\nEnd of Group Statement - KINONI SACCO Management System\n`;

    const blob = new Blob([statement], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group_statement_${format(new Date(), "yyyyMMdd")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Group statement generated successfully" });
    setLoading(false);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Member Statement</CardTitle>
          <CardDescription>Generate full statement for a specific member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Member</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember} onOpenChange={(open) => {
              if (open && members.length === 0) loadMembers();
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name} - {member.accounts?.[0]?.account_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => generateMemberStatement(false)} className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileDown className="mr-2 h-4 w-4" />
              Text (.txt)
            </Button>
            <Button onClick={() => generateMemberStatement(true)} variant="outline" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Group Statement</CardTitle>
          <CardDescription>Consolidated statement for all members with individual balances</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Includes all accounts with individual balances, full transaction history (balance after each entry), loans, and welfare records.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => generateGroupStatement(false)} className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileDown className="mr-2 h-4 w-4" />
              Text (.txt)
            </Button>
            <Button onClick={() => generateGroupStatement(true)} variant="outline" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel (.xlsx)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatementsGeneration;
