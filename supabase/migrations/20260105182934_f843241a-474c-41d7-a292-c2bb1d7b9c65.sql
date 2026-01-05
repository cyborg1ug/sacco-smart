-- Add tnx_id column to transactions table with unique 9-digit identifier
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tnx_id text;

-- Create function to generate unique 9-digit transaction ID
CREATE OR REPLACE FUNCTION public.generate_tnx_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tnx_id text;
  done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    -- Generate a 9-digit number
    new_tnx_id := LPAD(FLOOR(RANDOM() * 1000000000)::TEXT, 9, '0');
    -- Check if it exists
    done := NOT EXISTS (SELECT 1 FROM public.transactions WHERE tnx_id = new_tnx_id);
  END LOOP;
  RETURN new_tnx_id;
END;
$$;

-- Create trigger to auto-generate tnx_id on insert
CREATE OR REPLACE FUNCTION public.set_tnx_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tnx_id IS NULL THEN
    NEW.tnx_id := public.generate_tnx_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_transaction_tnx_id ON public.transactions;
CREATE TRIGGER set_transaction_tnx_id
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tnx_id();

-- Update existing transactions with tnx_id
UPDATE public.transactions 
SET tnx_id = public.generate_tnx_id() 
WHERE tnx_id IS NULL;

-- Make tnx_id NOT NULL and UNIQUE after populating
ALTER TABLE public.transactions 
  ALTER COLUMN tnx_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_tnx_id_unique ON public.transactions(tnx_id);

-- Create storage buckets for receipts and documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for receipts bucket (public read, admin write)
CREATE POLICY "Anyone can view receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "Admins can upload receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'));

-- RLS policies for documents bucket (private, admin access)
CREATE POLICY "Admins can view documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));