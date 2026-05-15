DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'pack_billing_cycle'
  ) THEN
    CREATE TYPE public.pack_billing_cycle AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
  END IF;
END
$$;

ALTER TABLE public.platform_packs
  ADD COLUMN IF NOT EXISTS base_price_mad numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle public.pack_billing_cycle NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN IF NOT EXISTS delivery_window text;

UPDATE public.platform_packs
SET base_price_mad = COALESCE(price_per_unit, 0)
WHERE base_price_mad IS NULL OR base_price_mad = 0;

CREATE TABLE IF NOT EXISTS public.pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.platform_packs(id) ON DELETE CASCADE,
  item_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pack_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.platform_packs(id) ON DELETE CASCADE,
  feature_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_items' AND policyname = 'Admins can view pack items'
  ) THEN
    CREATE POLICY "Admins can view pack items"
      ON public.pack_items
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_items' AND policyname = 'Admins can create pack items'
  ) THEN
    CREATE POLICY "Admins can create pack items"
      ON public.pack_items
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_items' AND policyname = 'Admins can update pack items'
  ) THEN
    CREATE POLICY "Admins can update pack items"
      ON public.pack_items
      FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_items' AND policyname = 'Admins can delete pack items'
  ) THEN
    CREATE POLICY "Admins can delete pack items"
      ON public.pack_items
      FOR DELETE
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_features' AND policyname = 'Admins can view pack features'
  ) THEN
    CREATE POLICY "Admins can view pack features"
      ON public.pack_features
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_features' AND policyname = 'Admins can create pack features'
  ) THEN
    CREATE POLICY "Admins can create pack features"
      ON public.pack_features
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_features' AND policyname = 'Admins can update pack features'
  ) THEN
    CREATE POLICY "Admins can update pack features"
      ON public.pack_features
      FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pack_features' AND policyname = 'Admins can delete pack features'
  ) THEN
    CREATE POLICY "Admins can delete pack features"
      ON public.pack_features
      FOR DELETE
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_pack_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_pack_features_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pack_items_updated_at ON public.pack_items;
CREATE TRIGGER trg_pack_items_updated_at
BEFORE UPDATE ON public.pack_items
FOR EACH ROW
EXECUTE FUNCTION public.set_pack_items_updated_at();

DROP TRIGGER IF EXISTS trg_pack_features_updated_at ON public.pack_features;
CREATE TRIGGER trg_pack_features_updated_at
BEFORE UPDATE ON public.pack_features
FOR EACH ROW
EXECUTE FUNCTION public.set_pack_features_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_subscription_ledger_entries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_category public.order_category;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.order_category INTO v_order_category
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_order_category = 'PLATFORM_SUBSCRIPTION'::public.order_category THEN
    RAISE EXCEPTION 'Ledger entry forbidden for PLATFORM_SUBSCRIPTION order: %', NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_subscription_ledger_entries ON public.platform_commission_ledger;
CREATE TRIGGER trg_prevent_subscription_ledger_entries
BEFORE INSERT OR UPDATE ON public.platform_commission_ledger
FOR EACH ROW
EXECUTE FUNCTION public.prevent_subscription_ledger_entries();