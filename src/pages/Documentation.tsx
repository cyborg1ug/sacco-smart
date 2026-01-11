import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  LogIn, 
  UserPlus, 
  LayoutDashboard, 
  PiggyBank, 
  CreditCard, 
  FileText, 
  Bell, 
  Users, 
  HandCoins,
  ChevronRight,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Shield,
  Smartphone,
  Monitor
} from "lucide-react";
import { motion } from "framer-motion";

const Documentation = () => {
  const navigate = useNavigate();

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-bold text-primary">KINONI SACCO Guide</h1>
          <Button onClick={() => navigate("/auth")} className="gap-2">
            Get Started
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <motion.section 
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <PiggyBank className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Welcome to KINONI SACCO
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your complete guide to getting started with our savings and credit cooperative platform.
            Follow this step-by-step guide to make the most of your membership.
          </p>
        </motion.section>

        {/* Quick Overview Cards */}
        <motion.section 
          className="grid md:grid-cols-3 gap-4 mb-12"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={fadeInUp}>
            <Card className="text-center h-full border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="pt-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                  <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold mb-1">Secure Platform</h3>
                <p className="text-sm text-muted-foreground">Your data is protected with enterprise-grade security</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <Card className="text-center h-full border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="pt-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                  <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold mb-1">Mobile Friendly</h3>
                <p className="text-sm text-muted-foreground">Access your account from any device, anywhere</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <Card className="text-center h-full border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="pt-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-3">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold mb-1">Track Growth</h3>
                <p className="text-sm text-muted-foreground">Monitor your savings and loan progress in real-time</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.section>

        {/* Getting Started Section */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
            Getting Started
          </h2>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </div>
                  Creating Your Account
                </CardTitle>
                <CardDescription>New members registration process</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Contact the Admin</p>
                      <p className="text-sm text-muted-foreground">Reach out to the SACCO administrator to register as a new member. Provide your full name, email address, phone number, and National ID.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Receive Your Credentials</p>
                      <p className="text-sm text-muted-foreground">The admin will create your account and send you login credentials via email.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Account Number Assignment</p>
                      <p className="text-sm text-muted-foreground">You will be assigned a unique account number (e.g., KINONI-001) for all your transactions.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <LogIn className="h-5 w-5 text-primary" />
                  </div>
                  Signing In
                </CardTitle>
                <CardDescription>Access your member dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      On Desktop
                    </h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Visit the KINONI SACCO website</li>
                      <li>Click "Sign In" button</li>
                      <li>Enter your email and password</li>
                      <li>Click "Login" to access your dashboard</li>
                    </ol>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      On Mobile
                    </h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Open your mobile browser</li>
                      <li>Navigate to the SACCO website</li>
                      <li>Tap "Sign In"</li>
                      <li>Enter credentials and tap "Login"</li>
                    </ol>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Tip:</strong> Use "Forgot Password?" if you need to reset your password. A reset link will be sent to your email.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Dashboard Overview */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
            Your Dashboard
          </h2>
          
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-primary/10">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                </div>
                Dashboard Overview
              </CardTitle>
              <CardDescription>Understanding your member dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Once logged in, you'll see your personalized dashboard with key information at a glance:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Wallet className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium">Account Balance</p>
                    <p className="text-sm text-muted-foreground">Your current available balance in UGX</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <PiggyBank className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">Total Savings</p>
                    <p className="text-sm text-muted-foreground">Cumulative savings over time</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <CreditCard className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-medium">Active Loans</p>
                    <p className="text-sm text-muted-foreground">Number of ongoing loans</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Bell className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="font-medium">Notifications</p>
                    <p className="text-sm text-muted-foreground">Important alerts and reminders</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Key Features */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
            Key Features
          </h2>

          <div className="space-y-4">
            {/* Record Transaction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <HandCoins className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  Record Transaction
                </CardTitle>
                <CardDescription>Make deposits, withdrawals, and loan repayments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">Record your financial transactions:</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      <strong>Deposit:</strong> Add money to your savings account
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      <strong>Withdrawal:</strong> Request to withdraw from your balance
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      <strong>Loan Repayment:</strong> Pay back your active loans (shows outstanding balance)
                    </li>
                  </ul>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> All transactions require admin approval before they reflect in your balance.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loan Application */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  Loan Application
                </CardTitle>
                <CardDescription>Apply for loans based on your savings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">Apply for a loan when you meet the eligibility criteria:</p>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <h4 className="font-medium">Eligibility Requirements:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Saved minimum UGX 10,000/week for 4 consecutive weeks
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Maximum loan: 3x your total savings
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Interest rate: 2% on the loan amount
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Requires a guarantor (another member)
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guarantor Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Guarantor Requests
                </CardTitle>
                <CardDescription>Manage loan guarantor responsibilities</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  When another member selects you as their loan guarantor, you'll receive a request. 
                  You can approve or decline based on your willingness to guarantee their loan.
                  The maximum amount you can guarantee is equal to your total savings.
                </p>
              </CardContent>
            </Card>

            {/* Savings Tracker */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <PiggyBank className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Savings Tracker
                </CardTitle>
                <CardDescription>Monitor your weekly savings progress</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  View your weekly savings history with visual charts. Track your progress towards 
                  loan eligibility and see how your savings grow over time.
                </p>
              </CardContent>
            </Card>

            {/* Transaction History & Statements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Transaction History & Statements
                </CardTitle>
                <CardDescription>Access your complete financial records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-muted-foreground">Keep track of all your financial activities:</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      View all deposits, withdrawals, and loan transactions
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      Download transaction receipts as PDF
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      Generate account statements for any date range
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary" />
                      Track transaction status (Pending/Approved/Rejected)
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Sub-Accounts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                    <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  Sub-Accounts
                </CardTitle>
                <CardDescription>Manage family member accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create and manage sub-accounts for family members. Each sub-account has its own 
                  balance and savings tracking while being linked to your main account. 
                  View joint totals to see combined family savings.
                </p>
              </CardContent>
            </Card>

            {/* Reminders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Reminders & Notifications
                </CardTitle>
                <CardDescription>Stay updated on important events</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Receive notifications about pending transactions, loan approvals, payment due dates, 
                  and important SACCO announcements. You'll also get email reminders for critical updates.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Profile Management */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
            Profile Management
          </h2>
          
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">
                Keep your profile information up to date for smooth communication:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Update your phone number and address
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  View your National ID and account details
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Change your password securely
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.section>

        {/* Need Help */}
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6 text-center">
              <h3 className="text-xl font-bold mb-2">Need Help?</h3>
              <p className="text-muted-foreground mb-4">
                If you encounter any issues or have questions, please contact the SACCO administrator 
                at <strong>vincentcibronz@gmail.com</strong>
              </p>
              <Button onClick={() => navigate("/auth")} size="lg" className="gap-2">
                Start Using KINONI SACCO
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} KINONI SACCO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Documentation;
