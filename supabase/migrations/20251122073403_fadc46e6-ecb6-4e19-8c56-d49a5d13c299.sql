-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  national_id TEXT,
  occupation TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create accounts table for member financial accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  account_number TEXT NOT NULL UNIQUE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_savings DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'loan_disbursement', 'loan_repayment')),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  balance_after DECIMAL(15, 2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 2.00,
  total_amount DECIMAL(15, 2) NOT NULL,
  outstanding_balance DECIMAL(15, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'completed')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on loans
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Create savings table for tracking weekly savings
CREATE TABLE public.savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, week_start)
);

-- Enable RLS on savings
ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Insert member role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  -- Generate account number and create account
  INSERT INTO public.accounts (user_id, account_number)
  VALUES (
    NEW.id,
    'ACC' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for accounts
CREATE POLICY "Users can view their own account"
  ON public.accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all accounts"
  ON public.accounts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all accounts"
  ON public.accounts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = transactions.account_id
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for loans
CREATE POLICY "Users can view their own loans"
  ON public.loans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = loans.account_id
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert loan applications"
  ON public.loans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = account_id
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all loans"
  ON public.loans FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all loans"
  ON public.loans FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for savings
CREATE POLICY "Users can view their own savings"
  ON public.savings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts
      WHERE accounts.id = savings.account_id
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all savings"
  ON public.savings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert savings"
  ON public.savings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to check loan eligibility
CREATE OR REPLACE FUNCTION public.check_loan_eligibility(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_min_amount DECIMAL(15, 2) := 10000;
BEGIN
  -- Check if account has 4 consecutive weeks of savings >= 10000 UGX
  SELECT COUNT(*) INTO v_count
  FROM public.savings
  WHERE account_id = p_account_id
    AND amount >= v_min_amount
    AND week_start >= (CURRENT_DATE - INTERVAL '4 weeks')
  GROUP BY account_id;
  
  RETURN COALESCE(v_count >= 4, FALSE);
END;
$$;

-- Insert default admin user role (vincentcibronz@gmail.com will need to sign up first)
-- This will be handled after the user signs up