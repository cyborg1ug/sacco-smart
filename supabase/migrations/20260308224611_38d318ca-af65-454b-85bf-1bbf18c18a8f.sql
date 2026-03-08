
-- ============================================================
-- Fix: Convert all access-granting RLS policies from RESTRICTIVE
-- to PERMISSIVE across all tables.
-- RESTRICTIVE policies with no PERMISSIVE counterparts deny all rows.
-- ============================================================

-- ========================
-- TABLE: profiles
-- ========================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous profiles access" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ========================
-- TABLE: accounts
-- ========================
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their sub-accounts" ON public.accounts;
DROP POLICY IF EXISTS "admin_insert_accounts" ON public.accounts;
DROP POLICY IF EXISTS "admin_update_accounts" ON public.accounts;
DROP POLICY IF EXISTS "Deny anonymous accounts access" ON public.accounts;

CREATE POLICY "Admins can view all accounts"
  ON public.accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own accounts"
  ON public.accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their sub-accounts"
  ON public.accounts FOR SELECT
  USING ((parent_account_id IS NOT NULL) AND user_owns_parent_account(parent_account_id));

CREATE POLICY "admin_insert_accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_accounts"
  ON public.accounts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================
-- TABLE: transactions
-- ========================
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete transactions"
  ON public.transactions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = transactions.account_id
      AND accounts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = transactions.account_id
      AND accounts.user_id = auth.uid()
  ));

-- ========================
-- TABLE: loans
-- ========================
DROP POLICY IF EXISTS "Admins can view all loans" ON public.loans;
DROP POLICY IF EXISTS "Admins can update all loans" ON public.loans;
DROP POLICY IF EXISTS "Users can view their own loans" ON public.loans;
DROP POLICY IF EXISTS "Users can insert loan applications" ON public.loans;
DROP POLICY IF EXISTS "Users can view loans where they are guarantor" ON public.loans;
DROP POLICY IF EXISTS "Guarantors can update their guarantor status" ON public.loans;

CREATE POLICY "Admins can view all loans"
  ON public.loans FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all loans"
  ON public.loans FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own loans"
  ON public.loans FOR SELECT
  USING (
    (EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = loans.account_id AND accounts.user_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM public.accounts sub JOIN public.accounts parent ON parent.id = sub.parent_account_id WHERE sub.id = loans.account_id AND parent.user_id = auth.uid()))
  );

CREATE POLICY "Users can insert loan applications"
  ON public.loans FOR INSERT
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = loans.account_id AND accounts.user_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM public.accounts sub JOIN public.accounts parent ON parent.id = sub.parent_account_id WHERE sub.id = loans.account_id AND parent.user_id = auth.uid()))
  );

CREATE POLICY "Users can view loans where they are guarantor"
  ON public.loans FOR SELECT
  USING (
    (EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = loans.guarantor_account_id AND accounts.user_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM public.accounts sub JOIN public.accounts parent ON parent.id = sub.parent_account_id WHERE sub.id = loans.guarantor_account_id AND parent.user_id = auth.uid()))
  );

CREATE POLICY "Guarantors can update their guarantor status"
  ON public.loans FOR UPDATE
  USING (
    (EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = loans.guarantor_account_id AND accounts.user_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM public.accounts sub JOIN public.accounts parent ON parent.id = sub.parent_account_id WHERE sub.id = loans.guarantor_account_id AND parent.user_id = auth.uid()))
  );

-- ========================
-- TABLE: savings
-- ========================
DROP POLICY IF EXISTS "Admins can view all savings" ON public.savings;
DROP POLICY IF EXISTS "Admins can insert savings" ON public.savings;
DROP POLICY IF EXISTS "Users can view their own savings" ON public.savings;

CREATE POLICY "Admins can view all savings"
  ON public.savings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert savings"
  ON public.savings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own savings"
  ON public.savings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = savings.account_id
      AND accounts.user_id = auth.uid()
  ));

-- ========================
-- TABLE: welfare
-- ========================
DROP POLICY IF EXISTS "Admins can view all welfare" ON public.welfare;
DROP POLICY IF EXISTS "Admins can insert welfare" ON public.welfare;
DROP POLICY IF EXISTS "Users can view their own welfare" ON public.welfare;

CREATE POLICY "Admins can view all welfare"
  ON public.welfare FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert welfare"
  ON public.welfare FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own welfare"
  ON public.welfare FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = welfare.account_id
      AND accounts.user_id = auth.uid()
  ));

-- ========================
-- TABLE: reminders
-- ========================
DROP POLICY IF EXISTS "Admins can view all reminders" ON public.reminders;
DROP POLICY IF EXISTS "Admins can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Admins can update all reminders" ON public.reminders;
DROP POLICY IF EXISTS "Admins can delete reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.reminders;

CREATE POLICY "Admins can view all reminders"
  ON public.reminders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all reminders"
  ON public.reminders FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reminders"
  ON public.reminders FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own reminders"
  ON public.reminders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = reminders.account_id
      AND accounts.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own reminders"
  ON public.reminders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = reminders.account_id
      AND accounts.user_id = auth.uid()
  ));

-- ========================
-- TABLE: user_roles
-- ========================
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ========================
-- TABLE: sub_account_profiles
-- ========================
DROP POLICY IF EXISTS "Admins can view all sub-account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Admins can insert sub-account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Admins can update all sub-account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Admins can delete sub-account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Users can view own sub account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Users can view their sub-account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Users can update their sub-account profiles" ON public.sub_account_profiles;
DROP POLICY IF EXISTS "Deny anonymous sub_account_profiles access" ON public.sub_account_profiles;

CREATE POLICY "Admins can view all sub-account profiles"
  ON public.sub_account_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sub-account profiles"
  ON public.sub_account_profiles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all sub-account profiles"
  ON public.sub_account_profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sub-account profiles"
  ON public.sub_account_profiles FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own sub account profiles"
  ON public.sub_account_profiles FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = sub_account_profiles.account_id
        AND (
          a.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.accounts parent
            WHERE parent.id = a.parent_account_id AND parent.user_id = auth.uid()
          )
        )
    ))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can update their sub-account profiles"
  ON public.sub_account_profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.accounts sa
    JOIN public.accounts pa ON sa.parent_account_id = pa.id
    WHERE sa.id = sub_account_profiles.account_id
      AND pa.user_id = auth.uid()
  ));
