-- Prepare user profiles to be resolved from Clerk while preserving existing UUIDs.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

ALTER TABLE public.user_profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'public.user_profiles'::regclass
      AND con.contype = 'f'
      AND att.attname = 'id'
  LOOP
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_clerk_user_id_key'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_clerk_user_id_key UNIQUE (clerk_user_id);
  END IF;
END $$;
