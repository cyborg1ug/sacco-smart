
-- Add admin-only DELETE policies for tables that currently have none

CREATE POLICY "Admins can delete loans"
  ON public.loans FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete savings"
  ON public.savings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete welfare"
  ON public.welfare FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
