-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE (default)

-- ========== ACCOUNTS TABLE ==========
DROP POLICY IF EXISTS "Admins can update all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;

CREATE POLICY "Admins can update all accounts" 
ON public.accounts 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all accounts" 
ON public.accounts 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own account" 
ON public.accounts 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- ========== LOANS TABLE ==========
DROP POLICY IF EXISTS "Admins can update all loans" ON public.loans;
DROP POLICY IF EXISTS "Admins can view all loans" ON public.loans;
DROP POLICY IF EXISTS "Users can insert loan applications" ON public.loans;
DROP POLICY IF EXISTS "Users can view their own loans" ON public.loans;

CREATE POLICY "Admins can update all loans" 
ON public.loans 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all loans" 
ON public.loans 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert loan applications" 
ON public.loans 
FOR INSERT 
TO authenticated
WITH CHECK (EXISTS ( SELECT 1
   FROM accounts
  WHERE ((accounts.id = loans.account_id) AND (accounts.user_id = auth.uid()))));

CREATE POLICY "Users can view their own loans" 
ON public.loans 
FOR SELECT 
TO authenticated
USING (EXISTS ( SELECT 1
   FROM accounts
  WHERE ((accounts.id = loans.account_id) AND (accounts.user_id = auth.uid()))));

-- ========== PROFILES TABLE ==========
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- ========== SAVINGS TABLE ==========
DROP POLICY IF EXISTS "Admins can insert savings" ON public.savings;
DROP POLICY IF EXISTS "Admins can view all savings" ON public.savings;
DROP POLICY IF EXISTS "Users can view their own savings" ON public.savings;

CREATE POLICY "Admins can insert savings" 
ON public.savings 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all savings" 
ON public.savings 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own savings" 
ON public.savings 
FOR SELECT 
TO authenticated
USING (EXISTS ( SELECT 1
   FROM accounts
  WHERE ((accounts.id = savings.account_id) AND (accounts.user_id = auth.uid()))));

-- ========== TRANSACTIONS TABLE ==========
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Admins can insert transactions" 
ON public.transactions 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update transactions" 
ON public.transactions 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (EXISTS ( SELECT 1
   FROM accounts
  WHERE ((accounts.id = transactions.account_id) AND (accounts.user_id = auth.uid()))));

-- ========== USER_ROLES TABLE ==========
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);