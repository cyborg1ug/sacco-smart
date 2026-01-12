import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Install from "./pages/Install";
import Documentation from "./pages/Documentation";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

// Member pages
import MemberOverview from "./pages/member/MemberOverview";
import MemberRecordTransaction from "./pages/member/MemberRecordTransaction";
import MemberTransactions from "./pages/member/MemberTransactions";
import MemberLoanApplication from "./pages/member/MemberLoanApplication";
import MemberGuarantorRequests from "./pages/member/MemberGuarantorRequests";
import MemberSavings from "./pages/member/MemberSavings";
import MemberRemindersPage from "./pages/member/MemberRemindersPage";
import MemberStatementPage from "./pages/member/MemberStatementPage";
import MemberSubAccounts from "./pages/member/MemberSubAccounts";
import MemberProfilePage from "./pages/member/MemberProfilePage";

// Admin pages
import AdminMembersPage from "./pages/admin/AdminMembersPage";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage";
import AdminMemberTransactions from "./pages/admin/AdminMemberTransactions";
import AdminLoansPage from "./pages/admin/AdminLoansPage";
import AdminWelfarePage from "./pages/admin/AdminWelfarePage";
import AdminRemindersPage from "./pages/admin/AdminRemindersPage";
import AdminStatementsPage from "./pages/admin/AdminStatementsPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="/document" element={<Documentation />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Member routes */}
            <Route path="/member/overview" element={<ProtectedRoute><MemberOverview /></ProtectedRoute>} />
            <Route path="/member/record-transaction" element={<ProtectedRoute><MemberRecordTransaction /></ProtectedRoute>} />
            <Route path="/member/transactions" element={<ProtectedRoute><MemberTransactions /></ProtectedRoute>} />
            <Route path="/member/loan-application" element={<ProtectedRoute><MemberLoanApplication /></ProtectedRoute>} />
            <Route path="/member/guarantor-requests" element={<ProtectedRoute><MemberGuarantorRequests /></ProtectedRoute>} />
            <Route path="/member/savings" element={<ProtectedRoute><MemberSavings /></ProtectedRoute>} />
            <Route path="/member/reminders" element={<ProtectedRoute><MemberRemindersPage /></ProtectedRoute>} />
            <Route path="/member/statement" element={<ProtectedRoute><MemberStatementPage /></ProtectedRoute>} />
            <Route path="/member/sub-accounts" element={<ProtectedRoute><MemberSubAccounts /></ProtectedRoute>} />
            <Route path="/member/profile" element={<ProtectedRoute><MemberProfilePage /></ProtectedRoute>} />
            
            {/* Admin routes */}
            <Route path="/admin/members" element={<ProtectedRoute><AdminMembersPage /></ProtectedRoute>} />
            <Route path="/admin/transactions" element={<ProtectedRoute><AdminTransactionsPage /></ProtectedRoute>} />
            <Route path="/admin/transactions/:accountId" element={<ProtectedRoute><AdminMemberTransactions /></ProtectedRoute>} />
            <Route path="/admin/loans" element={<ProtectedRoute><AdminLoansPage /></ProtectedRoute>} />
            <Route path="/admin/welfare" element={<ProtectedRoute><AdminWelfarePage /></ProtectedRoute>} />
            <Route path="/admin/reminders" element={<ProtectedRoute><AdminRemindersPage /></ProtectedRoute>} />
            <Route path="/admin/statements" element={<ProtectedRoute><AdminStatementsPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute><AdminReportsPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
