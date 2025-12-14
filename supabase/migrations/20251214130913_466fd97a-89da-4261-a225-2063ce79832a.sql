-- Create reminders table for member alerts
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- 'savings', 'loan_repayment', 'general'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  due_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Users can view their own reminders
CREATE POLICY "Users can view their own reminders"
ON public.reminders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM accounts 
    WHERE accounts.id = reminders.account_id 
    AND accounts.user_id = auth.uid()
  )
);

-- Users can mark their reminders as read
CREATE POLICY "Users can update their own reminders"
ON public.reminders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM accounts 
    WHERE accounts.id = reminders.account_id 
    AND accounts.user_id = auth.uid()
  )
);

-- Admins can view all reminders
CREATE POLICY "Admins can view all reminders"
ON public.reminders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create reminders
CREATE POLICY "Admins can insert reminders"
ON public.reminders
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all reminders
CREATE POLICY "Admins can update all reminders"
ON public.reminders
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete reminders
CREATE POLICY "Admins can delete reminders"
ON public.reminders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));