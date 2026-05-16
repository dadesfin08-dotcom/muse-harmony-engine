-- Subscription status enum for platform memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'platform_subscription_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.platform_subscription_status AS ENUM ('active', 'paused', 'expired', 'cancelled');
  END IF;
END$$;

-- Main subscription table for Platform Packs recurring memberships
CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  pack_id UUID NOT NULL REFERENCES public.platform_packs(id) ON DELETE RESTRICT,
  status public.platform_subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,
  next_scheduled_delivery_date DATE,
  lifetime_revenue_mad NUMERIC NOT NULL DEFAULT 0,
  deliveries_completed INTEGER NOT NULL DEFAULT 0,
  deliveries_expected INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link platform orders to subscriptions for history views
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.platform_subscriptions(id) ON DELETE SET NULL;

-- Indexes for admin dashboard filtering/search
CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_status
  ON public.platform_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_pack_id
  ON public.platform_subscriptions(pack_id);

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_next_delivery
  ON public.platform_subscriptions(next_scheduled_delivery_date);

CREATE INDEX IF NOT EXISTS idx_orders_subscription_id
  ON public.orders(subscription_id);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_platform_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_platform_subscriptions_updated_at ON public.platform_subscriptions;
CREATE TRIGGER trg_set_platform_subscriptions_updated_at
BEFORE UPDATE ON public.platform_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_platform_subscriptions_updated_at();

-- Enforce financial/ledger isolation at data level for linked subscription orders
CREATE OR REPLACE FUNCTION public.enforce_platform_subscription_order_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    NEW.order_category := 'PLATFORM_SUBSCRIPTION'::public.order_category;
    NEW.vendor_id := NULL;
    NEW.cash_to_collect_from_customer := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_platform_subscription_order_link ON public.orders;
CREATE TRIGGER trg_enforce_platform_subscription_order_link
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_platform_subscription_order_link();

-- RLS: admin-only management
ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view platform subscriptions" ON public.platform_subscriptions;
CREATE POLICY "Admins can view platform subscriptions"
ON public.platform_subscriptions
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can create platform subscriptions" ON public.platform_subscriptions;
CREATE POLICY "Admins can create platform subscriptions"
ON public.platform_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update platform subscriptions" ON public.platform_subscriptions;
CREATE POLICY "Admins can update platform subscriptions"
ON public.platform_subscriptions
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete platform subscriptions" ON public.platform_subscriptions;
CREATE POLICY "Admins can delete platform subscriptions"
ON public.platform_subscriptions
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));