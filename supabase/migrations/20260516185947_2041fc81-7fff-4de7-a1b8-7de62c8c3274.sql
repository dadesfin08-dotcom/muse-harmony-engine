ALTER TYPE public.platform_subscription_status ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE public.platform_subscriptions
  ADD COLUMN IF NOT EXISTS agreed_price numeric,
  ADD COLUMN IF NOT EXISTS total_deliveries integer,
  ADD COLUMN IF NOT EXISTS completed_deliveries integer NOT NULL DEFAULT 0;

UPDATE public.platform_subscriptions
SET total_deliveries = COALESCE(total_deliveries, deliveries_expected)
WHERE total_deliveries IS NULL;

UPDATE public.platform_subscriptions
SET completed_deliveries = COALESCE(completed_deliveries, deliveries_completed, 0)
WHERE completed_deliveries IS NULL;

ALTER TABLE public.platform_subscriptions
  ALTER COLUMN completed_deliveries SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_status_created_at
  ON public.platform_subscriptions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_subscription_status_created_at
  ON public.orders(subscription_id, status, created_at DESC)
  WHERE subscription_id IS NOT NULL;