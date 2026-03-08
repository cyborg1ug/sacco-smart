import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Users, TrendingUp, Building2, BarChart3, CreditCard, PiggyBank } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Shield,    title: "Secure & Compliant",    desc: "Role-based access with enterprise-grade security and audit trails." },
  { icon: Users,     title: "Member Management",     desc: "Full member lifecycle management with sub-accounts and guarantors." },
  { icon: TrendingUp,title: "Loan Processing",       desc: "End-to-end loan origination, approval, disbursement and tracking." },
  { icon: BarChart3, title: "Financial Analytics",   desc: "Real-time dashboards with savings growth and repayment charts." },
  { icon: CreditCard,title: "Transaction Control",   desc: "Approve, reject and audit every financial transaction." },
  { icon: PiggyBank, title: "Savings Tracking",      desc: "Monitor individual and collective savings progress over time." },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-30 bg-card/80 backdrop-blur border-b border-border/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-sm tracking-tight">KINONI SACCO</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-sm" onClick={() => navigate("/auth?mode=login")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth?mode=signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4 animated-gradient">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-6 tracking-wide uppercase">
              <Building2 className="w-3.5 h-3.5" />
              Digital Banking Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight leading-tight mb-5">
              Modern SACCO
              <span className="block text-primary">Management Platform</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              A professional digital banking interface for savings, loans, and member management — designed for Kinoni SACCO's growing community.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button size="lg" className="gap-2 px-8" onClick={() => navigate("/auth?mode=login")}>
                Access Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=signup")}>
                Create Account
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border/60 bg-card py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: "Members Served",     value: "500+" },
              { label: "Loans Processed",    value: "UGX 200M+" },
              { label: "Transactions Daily", value: "100+" },
              { label: "Uptime",             value: "99.9%" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              >
                <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Everything your SACCO needs</h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-sm">
              A complete platform built for Uganda's cooperative banking environment.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                className="p-5 bg-card rounded-xl border border-border/60 card-hover group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/12 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 border-t border-border/60 bg-muted/30">
        <div className="container mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to get started?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to access your dashboard or contact your SACCO administrator for an account.
          </p>
          <Button size="lg" className="gap-2" onClick={() => navigate("/auth?mode=login")}>
            Access Portal <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-border/60 bg-card">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Building2 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-xs font-semibold text-foreground">KINONI SACCO</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 Kinoni SACCO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
