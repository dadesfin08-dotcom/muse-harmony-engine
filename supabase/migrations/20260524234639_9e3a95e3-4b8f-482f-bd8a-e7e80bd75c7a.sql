CREATE TABLE IF NOT EXISTS public.mobile_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mobile_api_keys
  ADD COLUMN IF NOT EXISTS key_name TEXT,
  ADD COLUMN IF NOT EXISTS key_prefix TEXT,
  ADD COLUMN IF NOT EXISTS api_key_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.mobile_api_keys
  ALTER COLUMN key_name SET NOT NULL,
  ALTER COLUMN key_prefix SET NOT NULL,
  ALTER COLUMN api_key_hash SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mobile_api_keys_api_key_hash_key'
      AND conrelid = 'public.mobile_api_keys'::regclass
  ) THEN
    ALTER TABLE public.mobile_api_keys
      ADD CONSTRAINT mobile_api_keys_api_key_hash_key UNIQUE (api_key_hash);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_mobile_api_keys_is_active
  ON public.mobile_api_keys (is_active);

CREATE INDEX IF NOT EXISTS idx_mobile_api_keys_created_at
  ON public.mobile_api_keys (created_at DESC);

ALTER TABLE public.mobile_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_api_keys'
      AND policyname = 'Admins can view mobile api keys'
  ) THEN
    CREATE POLICY "Admins can view mobile api keys"
      ON public.mobile_api_keys
      FOR SELECT
      TO authenticated
      USING (is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_api_keys'
      AND policyname = 'Admins can create mobile api keys'
  ) THEN
    CREATE POLICY "Admins can create mobile api keys"
      ON public.mobile_api_keys
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_api_keys'
      AND policyname = 'Admins can update mobile api keys'
  ) THEN
    CREATE POLICY "Admins can update mobile api keys"
      ON public.mobile_api_keys
      FOR UPDATE
      TO authenticated
      USING (is_admin(auth.uid()))
      WITH CHECK (is_admin(auth.uid()));
  END IF;
END
$$;