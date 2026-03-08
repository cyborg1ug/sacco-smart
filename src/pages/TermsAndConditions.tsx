import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Building2, Shield, Mail } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <motion.div {...fadeUp} className="mb-8">
    <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
      <Shield className="h-4 w-4 text-primary shrink-0" />
      {title}
    </h2>
    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pl-6">{children}</div>
  </motion.div>
);

const Clause = ({ number, children }: { number: string; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <span className="font-semibold text-foreground shrink-0 w-6">{number}.</span>
    <p>{children}</p>
  </div>
);

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">KINONI SACCO</p>
              <p className="text-[10px] text-muted-foreground">Terms & Conditions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <motion.div {...fadeUp} className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms and Conditions</h1>
          <p className="text-muted-foreground text-sm">
            Effective Date: January 1, 2025 &nbsp;·&nbsp; Last Updated: March 1, 2026
          </p>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto">
            Please read these Terms and Conditions carefully before using the KINONI SACCO platform. By accessing or
            using our services, you agree to be bound by these terms.
          </p>
        </motion.div>

        <Card className="border border-border/60 shadow-sm mb-6">
          <CardHeader className="pb-3 bg-primary/5 rounded-t-lg">
            <CardTitle className="text-sm font-semibold text-primary">Important Notice</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-sm text-muted-foreground leading-relaxed">
            These Terms and Conditions govern your use of the KINONI SACCO digital platform operated by{" "}
            <span className="font-semibold text-foreground">CYBERSTEM Ltd.</span> If you do not agree to any part of
            these terms, you must discontinue use of the platform immediately. CYBERSTEM Ltd. reserves the right to
            update these terms at any time with notice to members.
          </CardContent>
        </Card>

        <Section title="1. Definitions">
          <Clause number="1.1">
            <strong className="text-foreground">"Platform"</strong> refers to the KINONI SACCO web and mobile
            application, including all features, tools, and services provided therein.
          </Clause>
          <Clause number="1.2">
            <strong className="text-foreground">"Member"</strong> refers to any individual or entity registered and
            approved as a member of KINONI SACCO.
          </Clause>
          <Clause number="1.3">
            <strong className="text-foreground">"Administrator"</strong> refers to authorised personnel of KINONI SACCO
            with elevated system privileges to manage members, transactions, and records.
          </Clause>
          <Clause number="1.4">
            <strong className="text-foreground">"CYBERSTEM Ltd."</strong> is the software developer and platform
            operator registered in Uganda, responsible for maintaining and securing the KINONI SACCO platform.
          </Clause>
          <Clause number="1.5">
            <strong className="text-foreground">"Services"</strong> include savings management, loan applications, loan
            repayment tracking, welfare contributions, financial statements, and all related functionalities.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="2. Eligibility and Account Access">
          <Clause number="2.1">
            Only individuals who have been formally registered as members of KINONI SACCO by an Administrator are
            eligible to access member services on this Platform.
          </Clause>
          <Clause number="2.2">
            Members must maintain the confidentiality of their login credentials and are fully responsible for all
            activities conducted under their account.
          </Clause>
          <Clause number="2.3">
            Members must promptly report any unauthorised access, suspected account compromise, or security breach to
            KINONI SACCO management.
          </Clause>
          <Clause number="2.4">
            Sub-accounts may be created under a primary member account for joint family savings. Sub-account holders
            are bound by the same terms as the primary member.
          </Clause>
          <Clause number="2.5">
            KINONI SACCO and CYBERSTEM Ltd. reserve the right to suspend or terminate any account found to be used in
            violation of these Terms.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="3. Financial Transactions">
          <Clause number="3.1">
            All deposit, withdrawal, and loan repayment transactions submitted through the Platform are subject to
            review and approval by an authorised Administrator before taking effect.
          </Clause>
          <Clause number="3.2">
            Members are responsible for ensuring the accuracy of all transaction details submitted. KINONI SACCO shall
            not be liable for losses arising from errors in member-submitted information.
          </Clause>
          <Clause number="3.3">
            Approved transactions generate a unique Transaction ID (TNX-ID) and may generate an official receipt
            available for download within the Platform.
          </Clause>
          <Clause number="3.4">
            Pending transactions may be rejected by Administrators for reasons including insufficient documentation,
            policy non-compliance, or suspected fraud.
          </Clause>
          <Clause number="3.5">
            Account balances displayed on the Platform reflect the last approved state and may not include transactions
            currently under review.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="4. Loan Terms">
          <Clause number="4.1">
            Loan applications submitted through the Platform are subject to eligibility assessment, guarantor
            verification, and Administrator approval. Submission does not guarantee disbursement.
          </Clause>
          <Clause number="4.2">
            Members must designate an eligible guarantor for each loan application. The guarantor must consent to
            their role and must meet the minimum savings threshold set by KINONI SACCO policy.
          </Clause>
          <Clause number="4.3">
            Loans carry an interest rate as communicated at the time of application. The total repayable amount
            (principal + interest) is displayed on the Platform prior to disbursement.
          </Clause>
          <Clause number="4.4">
            Loans not repaid within the agreed repayment period will accrue daily overdue interest penalties
            automatically applied by the system. Members are responsible for monitoring their loan status.
          </Clause>
          <Clause number="4.5">
            KINONI SACCO reserves the right to recover outstanding loan amounts from a member's savings balance or
            guarantor's savings balance in cases of prolonged default.
          </Clause>
          <Clause number="4.6">
            Members may not apply for a new loan while a previous loan remains outstanding, unless otherwise approved
            by KINONI SACCO management.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="5. Savings and Welfare">
          <Clause number="5.1">
            Members are expected to maintain regular savings contributions as per KINONI SACCO policy. Savings
            balances are tracked weekly on the Platform.
          </Clause>
          <Clause number="5.2">
            Weekly welfare contributions are automatically deducted from member accounts as per approved KINONI SACCO
            welfare policy. Members will be notified of deduction schedules.
          </Clause>
          <Clause number="5.3">
            Savings balances accrue within KINONI SACCO and are subject to the withdrawal terms and conditions
            established by KINONI SACCO management, which may include notice periods.
          </Clause>
          <Clause number="5.4">
            KINONI SACCO does not guarantee returns on savings beyond what is explicitly communicated in approved
            SACCO policies.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="6. Guarantor Obligations">
          <Clause number="6.1">
            By accepting a guarantor request on the Platform, a member acknowledges and accepts legal and financial
            responsibility for the borrower's loan repayment in the event of default.
          </Clause>
          <Clause number="6.2">
            Guarantors must have sufficient savings to cover the guaranteed loan amount as per eligibility criteria
            set by KINONI SACCO.
          </Clause>
          <Clause number="6.3">
            Guarantors may be notified via the Platform and email of any defaults or overdue status on loans they
            have guaranteed.
          </Clause>
          <Clause number="6.4">
            A guarantor may not guarantee a loan that exceeds the limits set in KINONI SACCO's active loan policy.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="7. Data Privacy and Security">
          <Clause number="7.1">
            CYBERSTEM Ltd. collects, stores, and processes member personal and financial data solely for the purpose
            of operating the KINONI SACCO Platform and providing Services.
          </Clause>
          <Clause number="7.2">
            Member data is stored securely using industry-standard encryption. CYBERSTEM Ltd. does not sell or share
            member data with third parties without explicit consent, except as required by applicable law.
          </Clause>
          <Clause number="7.3">
            Members have the right to request access to, correction of, or deletion of their personal data by
            contacting KINONI SACCO management, subject to legal and regulatory requirements.
          </Clause>
          <Clause number="7.4">
            The Platform uses secure authentication mechanisms. Members are advised not to share their passwords and
            to use strong, unique credentials.
          </Clause>
          <Clause number="7.5">
            CYBERSTEM Ltd. implements reasonable technical and organisational security measures but cannot guarantee
            absolute security against all possible cyber threats.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="8. Notifications and Reminders">
          <Clause number="8.1">
            The Platform may send in-app notifications and email reminders regarding pending loan repayments, overdue
            balances, pending transactions, and SACCO announcements.
          </Clause>
          <Clause number="8.2">
            Members are responsible for maintaining accurate and active contact information (email address, phone
            number) on their profile to receive critical notifications.
          </Clause>
          <Clause number="8.3">
            KINONI SACCO and CYBERSTEM Ltd. are not liable for any financial consequences arising from a member's
            failure to receive notifications due to incorrect contact details or disabled notifications.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="9. Platform Availability and Maintenance">
          <Clause number="9.1">
            CYBERSTEM Ltd. endeavours to maintain continuous Platform availability but does not guarantee uninterrupted
            access. Scheduled maintenance, updates, or unforeseen technical issues may cause temporary downtime.
          </Clause>
          <Clause number="9.2">
            CYBERSTEM Ltd. shall not be held liable for any financial losses or inconveniences arising from Platform
            downtime, data sync delays, or technical errors beyond its reasonable control.
          </Clause>
          <Clause number="9.3">
            Members are advised to retain independent records of their financial transactions with KINONI SACCO and not
            to rely solely on Platform-displayed balances for critical financial decisions.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="10. Prohibited Activities">
          <Clause number="10.1">
            Members must not attempt to access administrator functions, other members' accounts, or system data without
            authorisation.
          </Clause>
          <Clause number="10.2">
            Members must not submit false, misleading, or fraudulent transaction information or loan applications.
          </Clause>
          <Clause number="10.3">
            Any attempt to manipulate, reverse-engineer, or exploit the Platform's systems is strictly prohibited and
            may result in immediate account termination and legal action.
          </Clause>
          <Clause number="10.4">
            Members must not use the Platform in any manner that violates applicable laws of the Republic of Uganda or
            any other jurisdiction.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="11. Limitation of Liability">
          <Clause number="11.1">
            CYBERSTEM Ltd. provides the Platform on an "as-is" basis and makes no warranties, express or implied,
            regarding the accuracy, completeness, or fitness for a particular purpose of the Platform.
          </Clause>
          <Clause number="11.2">
            To the maximum extent permitted by law, CYBERSTEM Ltd. shall not be liable for any indirect, incidental,
            special, or consequential damages arising from your use of the Platform.
          </Clause>
          <Clause number="11.3">
            KINONI SACCO's liability for any direct damages shall not exceed the amount of fees paid by the member in
            the twelve (12) months prior to the event giving rise to the claim.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="12. Amendments">
          <Clause number="12.1">
            CYBERSTEM Ltd. and KINONI SACCO reserve the right to amend these Terms and Conditions at any time.
            Amended terms will be published on the Platform with the updated effective date.
          </Clause>
          <Clause number="12.2">
            Continued use of the Platform after publication of amended Terms constitutes acceptance of the revised
            Terms. Members who do not accept revised Terms should cease using the Platform.
          </Clause>
        </Section>

        <Separator className="mb-8" />

        <Section title="13. Governing Law">
          <Clause number="13.1">
            These Terms and Conditions are governed by and construed in accordance with the laws of the Republic of
            Uganda. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the courts of
            Uganda.
          </Clause>
          <Clause number="13.2">
            Where possible, disputes should first be addressed through KINONI SACCO's internal dispute resolution
            mechanisms before escalation to legal proceedings.
          </Clause>
        </Section>

        {/* Contact */}
        <motion.div {...fadeUp}>
          <Card className="border border-primary/20 bg-primary/5">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Questions or Concerns?</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    For any questions regarding these Terms and Conditions or the KINONI SACCO platform, please contact:
                  </p>
                  <p className="text-sm font-medium text-foreground">CYBERSTEM Ltd.</p>
                  <a
                    href="mailto:cyberstemug@gmail.com"
                    className="text-sm text-primary hover:underline"
                  >
                    cyberstemug@gmail.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 mt-12 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CYBERSTEM Ltd. All rights reserved. &nbsp;·&nbsp; KINONI SACCO Platform
        </p>
      </footer>
    </div>
  );
}
