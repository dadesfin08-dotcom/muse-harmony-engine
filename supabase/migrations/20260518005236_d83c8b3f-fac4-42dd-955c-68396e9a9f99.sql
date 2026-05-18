ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fake_orders integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_orders integer NOT NULL DEFAULT 0;