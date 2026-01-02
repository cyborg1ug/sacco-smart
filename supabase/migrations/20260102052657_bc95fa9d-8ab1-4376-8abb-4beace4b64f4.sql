-- Remove unique constraint on user_id to allow sub-accounts to share parent's user_id
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_key;