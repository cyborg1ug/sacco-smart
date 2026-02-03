-- First, drop the existing check constraint on status
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;

-- Add an updated check constraint that includes 'active' status
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check 
CHECK (status IN ('pending', 'approved', 'active', 'disbursed', 'rejected', 'completed', 'fully_paid'));

-- Enable realtime for loans table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'loans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
  END IF;
END
$$;