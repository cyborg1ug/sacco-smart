import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, CreditCard, TrendingUp, Heart, Bell,
  FileText, BarChart3, Settings, ChevronLeft, ChevronRight,
  Building2, LogOut, Moon, Sun, Menu, X,
  PiggyBank, Shield, History, Eye, PlusCircle, UsersRound, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  userName?: string;
  accountNumber?: string;
  pendingCount?: number;
  pendingGuarantor?: number;
  hasSubAccounts?: boolean;
  onRefresh?: () => void;
}

const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard" },
  { icon: Users,           label: "Members",      path: "/admin/members" },
  { icon: CreditCard,      label: "Transactions", path: "/admin/transactions" },
  { icon: TrendingUp,      label: "Loans",        path: "/admin/loans" },
  { icon: Heart,           label: "Welfare",      path: "/admin/welfare" },
  { icon: Bell,            label: "Reminders",    path: "/admin/reminders" },
  { icon: FileText,        label: "Statements",   path: "/admin/statements" },
  { icon: BarChart3,       label: "Reports",      path: "/admin/reports" },
];

const getMemberNavItems = (hasSubAccounts: boolean, pendingGuarantor: number): NavItem[] => [
  { icon: LayoutDashboard, label: "Dashboard",      path: "/dashboard" },
  { icon: Eye,             label: "Overview",        path: "/member/overview" },
  { icon: PlusCircle,      label: "Record",          path: "/member/record-transaction" },
  { icon: History,         label: "Transactions",    path: "/member/transactions" },
  { icon: CreditCard,      label: "Loans",           path: "/member/loan-application" },
  { icon: Shield,          label: "Guarantor",       path: "/member/guarantor-requests", badge: pendingGuarantor },
  { icon: PiggyBank,       label: "Savings",         path: "/member/savings" },
  { icon: Bell,            label: "Reminders",       path: "/member/reminders" },
  { icon: FileText,        label: "Statement",       path: "/member/statement" },
  ...(hasSubAccounts ? [{ icon: UsersRound, label: "Sub-Accounts", path: "/member/sub-accounts" }] : []),
  { icon: User,            label: "Profile",         path: "/member/profile" },
];

export default function DashboardLayout({
  children,
  isAdmin,
  userName = "",
  accountNumber = "",
  pendingCount = 0,
  pendingGuarantor = 0,
  hasSubAccounts = false,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const navItems = isAdmin
    ? adminNavItems.map(i => i.path === "/admin/transactions" ? { ...i, badge: pendingCount } : i)
    : getMemberNavItems(hasSubAccounts, pendingGuarantor);

  const initials = userName
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "KS";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth?mode=login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        collapsed && "justify-center px-3"
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-bold text-white leading-tight whitespace-nowrap">KINONI SACCO</p>
              <p className="text-xs text-sidebar-foreground/60 whitespace-nowrap">
                {isAdmin ? "Admin Portal" : "Member Portal"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName || "User"}</p>
              {isAdmin ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">Admin</Badge>
              ) : (
                <p className="text-[10px] text-sidebar-foreground/60 truncate font-mono">{accountNumber}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {!collapsed && (
          <p className="section-heading px-2 pb-2 text-sidebar-foreground/40">
            {isAdmin ? "Management" : "Navigation"}
          </p>
        )}
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-sidebar-foreground/70 hover:bg-white/6 hover:text-white"
              )}
            >
              <item.icon className={cn("shrink-0 w-4 h-4", isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-white")} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 text-left whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-destructive text-white border-0">
                  {item.badge}
                </Badge>
              )}
              {collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-white/6 hover:text-white transition-all",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "dark"
            ? <Sun className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && <span className="whitespace-nowrap">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden md:flex flex-col bg-sidebar relative shrink-0 overflow-hidden"
        style={{ boxShadow: "2px 0 20px hsl(0 0% 0% / 0.15)" }}
      >
        <SidebarContent />
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-4 -right-3 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center hover:bg-primary hover:border-primary transition-colors z-10"
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3 text-sidebar-foreground" />
            : <ChevronLeft className="w-3 h-3 text-sidebar-foreground" />}
        </button>
      </motion.aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-sidebar z-50 overflow-hidden"
              style={{ boxShadow: "4px 0 24px hsl(0 0% 0% / 0.3)" }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="shrink-0 h-14 flex items-center justify-between px-4 bg-card border-b border-border/60"
          style={{ boxShadow: "0 1px 4px hsl(0 0% 0% / 0.06)" }}>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-none">
                {isAdmin ? "Admin Dashboard" : "My Account"}
              </h1>
              {!isAdmin && accountNumber && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{accountNumber}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary hidden sm:flex">
                Administrator
              </Badge>
            )}
            <Avatar className="w-8 h-8 cursor-pointer">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-10">
          <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>

        {/* Copyright Footer — fixed at bottom center */}
        <footer className="shrink-0 border-t border-border/40 py-2 px-4 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/60">
            <span>© {new Date().getFullYear()} CYBERSTEM Ltd. All rights reserved.</span>
            <span className="opacity-40">·</span>
            <button
              onClick={() => navigate("/terms")}
              className="hover:text-muted-foreground transition-colors underline underline-offset-2"
            >
              Terms & Conditions
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
