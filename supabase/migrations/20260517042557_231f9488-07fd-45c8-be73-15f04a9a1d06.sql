-- 1) Harden existing push subscriptions metadata (non-destructive)
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS last_location text;

UPDATE public.push_subscriptions
SET user_role = CASE
  WHEN user_type = 'cyclist' THEN 'cyclist'
  ELSE 'customer'
END
WHERE user_role IS NULL;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN user_role SET DEFAULT 'customer';

-- Keep user_type and user_role synchronized during transition
CREATE OR REPLACE FUNCTION public.sync_push_subscription_role_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_role IS NULL OR btrim(NEW.user_role) = '' THEN
    NEW.user_role := CASE
      WHEN NEW.user_type = 'cyclist' THEN 'cyclist'
      ELSE 'customer'
    END;
  END IF;

  IF NEW.user_type IS NULL OR btrim(NEW.user_type) = '' THEN
    NEW.user_type := CASE
      WHEN NEW.user_role = 'cyclist' THEN 'cyclist'
      ELSE 'customer'
    END;
  END IF;

  IF NEW.user_role = 'cyclist' THEN
    NEW.user_type := 'cyclist';
  ELSE
    NEW.user_role := 'customer';
    NEW.user_type := 'customer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_push_subscription_role_fields ON public.push_subscriptions;
CREATE TRIGGER tr_sync_push_subscription_role_fields
BEFORE INSERT OR UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_push_subscription_role_fields();

-- 2) Push outbox table for idempotent, race-safe processing
CREATE TABLE IF NOT EXISTS public.order_push_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  event_type text NOT NULL,
  status_before text,
  status_after text,
  customer_user_id uuid,
  neighborhood_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_started_at timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_push_events_pending
  ON public.order_push_events (processed_at, attempts, created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_push_events_order_created
  ON public.order_push_events (order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_push_events_order_event_status
  ON public.order_push_events (order_id, event_type, COALESCE(status_after, ''));

ALTER TABLE public.order_push_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order push events" ON public.order_push_events;
CREATE POLICY "Admins can view order push events"
ON public.order_push_events
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3) Mapping + trigger function to enqueue order lifecycle push events
CREATE OR REPLACE FUNCTION public.map_order_status_to_push_event(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(coalesce(_status, ''))
    WHEN 'new' THEN 'ORDER_CREATED'
    WHEN 'pending' THEN 'ORDER_CREATED'
    WHEN 'preparing' THEN 'MERCHANT_ACCEPTED'
    WHEN 'ready' THEN 'ORDER_READY'
    WHEN 'delivering' THEN 'RIDER_PICKED_UP'
    WHEN 'delivered' THEN 'ORDER_COMPLETED'
    WHEN 'delivered_cash_with_cyclist' THEN 'ORDER_COMPLETED'
    WHEN 'cash_transferred_to_vendor' THEN 'ORDER_COMPLETED'
    ELSE 'STATUS_UPDATE'
  END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_order_push_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_should_enqueue boolean := false;
  v_event_type text;
  v_status_before text := NULL;
  v_status_after text := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_enqueue := true;
    v_status_after := NEW.status::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_status_before := OLD.status::text;
    v_status_after := NEW.status::text;
    v_should_enqueue := (OLD.status IS DISTINCT FROM NEW.status);
  END IF;

  IF NOT v_should_enqueue THEN
    RETURN NEW;
  END IF;

  v_event_type := public.map_order_status_to_push_event(v_status_after);

  INSERT INTO public.order_push_events (
    order_id,
    event_type,
    status_before,
    status_after,
    customer_user_id,
    neighborhood_id,
    payload
  )
  VALUES (
    NEW.id,
    v_event_type,
    v_status_before,
    v_status_after,
    NEW.customer_user_id,
    NEW.neighborhood_id,
    jsonb_build_object(
      'orderId', NEW.id,
      'eventType', v_event_type,
      'statusBefore', v_status_before,
      'statusAfter', v_status_after,
      'customerUserId', NEW.customer_user_id,
      'neighborhoodId', NEW.neighborhood_id,
      'orderCategory', NEW.order_category,
      'paymentMethod', NEW.payment_method,
      'createdAt', NEW.created_at
    )
  )
  ON CONFLICT (order_id, event_type, COALESCE(status_after, '')) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_order_push_enqueue ON public.orders;
CREATE TRIGGER tr_order_push_enqueue
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_order_push_event();