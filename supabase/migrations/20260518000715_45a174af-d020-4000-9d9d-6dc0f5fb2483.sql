DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_status') THEN
    CREATE TYPE public.customer_status AS ENUM ('active', 'vip', 'warning', 'suspicious', 'blocked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_risk_score') THEN
    CREATE TYPE public.customer_risk_score AS ENUM ('low', 'medium', 'high');
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.customer_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS risk_score public.customer_risk_score NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS strikes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_rejections integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS lifetime_value numeric NOT NULL DEFAULT 0;