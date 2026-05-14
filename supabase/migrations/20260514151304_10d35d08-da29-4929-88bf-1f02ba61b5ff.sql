-- 1) Enum for markup type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'markup_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.markup_type AS ENUM ('fixed', 'percentage');
  END IF;
END$$;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.markup_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_price numeric(12,2) NOT NULL,
  max_price numeric(12,2) NOT NULL,
  markup_type public.markup_type NOT NULL,
  markup_value numeric(12,4) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT markup_rules_price_bounds CHECK (min_price >= 0 AND max_price > min_price),
  CONSTRAINT markup_rules_value_bounds CHECK (markup_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_markup_rules_active ON public.markup_rules (is_active);
CREATE INDEX IF NOT EXISTS idx_markup_rules_range ON public.markup_rules (min_price, max_price);

-- 3) Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_markup_rules_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_markup_rules_updated_at ON public.markup_rules;
CREATE TRIGGER trg_set_markup_rules_updated_at
BEFORE UPDATE ON public.markup_rules
FOR EACH ROW
EXECUTE FUNCTION public.set_markup_rules_updated_at();

-- 4) Enable RLS
ALTER TABLE public.markup_rules ENABLE ROW LEVEL SECURITY;

-- 5) Policies (admin-only)
DROP POLICY IF EXISTS "Admins can view markup rules" ON public.markup_rules;
CREATE POLICY "Admins can view markup rules"
ON public.markup_rules
FOR SELECT
TO public
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert markup rules" ON public.markup_rules;
CREATE POLICY "Admins can insert markup rules"
ON public.markup_rules
FOR INSERT
TO public
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update markup rules" ON public.markup_rules;
CREATE POLICY "Admins can update markup rules"
ON public.markup_rules
FOR UPDATE
TO public
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete markup rules" ON public.markup_rules;
CREATE POLICY "Admins can delete markup rules"
ON public.markup_rules
FOR DELETE
TO public
USING (public.is_admin(auth.uid()));

-- 6) Seed defaults (idempotent)
INSERT INTO public.markup_rules (min_price, max_price, markup_type, markup_value, is_active)
SELECT 1, 5, 'fixed'::public.markup_type, 0.5, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.markup_rules
  WHERE min_price = 1 AND max_price = 5 AND markup_type = 'fixed'::public.markup_type AND markup_value = 0.5
);

INSERT INTO public.markup_rules (min_price, max_price, markup_type, markup_value, is_active)
SELECT 5, 20, 'fixed'::public.markup_type, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.markup_rules
  WHERE min_price = 5 AND max_price = 20 AND markup_type = 'fixed'::public.markup_type AND markup_value = 1
);

INSERT INTO public.markup_rules (min_price, max_price, markup_type, markup_value, is_active)
SELECT 20, 100, 'fixed'::public.markup_type, 2, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.markup_rules
  WHERE min_price = 20 AND max_price = 100 AND markup_type = 'fixed'::public.markup_type AND markup_value = 2
);

INSERT INTO public.markup_rules (min_price, max_price, markup_type, markup_value, is_active)
SELECT 100, 9999, 'percentage'::public.markup_type, 3, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.markup_rules
  WHERE min_price = 100 AND max_price = 9999 AND markup_type = 'percentage'::public.markup_type AND markup_value = 3
);