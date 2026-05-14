-- 1) Audit table for order status + settlement operations
CREATE TABLE IF NOT EXISTS public.order_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  order_id UUID NULL,
  vendor_id UUID NULL,
  cyclist_id UUID NULL,
  previous_status public.order_status NULL,
  new_status public.order_status NULL,
  actor_user_id UUID NULL,
  actor_role TEXT NULL,
  source TEXT NOT NULL DEFAULT 'database',
  settlement_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_audit_logs_event_type_chk CHECK (event_type IN ('order_status_changed', 'settlement_batch_processed'))
);

CREATE INDEX IF NOT EXISTS idx_order_audit_logs_created_at ON public.order_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_audit_logs_order_id ON public.order_audit_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_order_audit_logs_vendor_id ON public.order_audit_logs (vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_audit_logs_cyclist_id ON public.order_audit_logs (cyclist_id);
CREATE INDEX IF NOT EXISTS idx_order_audit_logs_event_type ON public.order_audit_logs (event_type);

ALTER TABLE public.order_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order audit logs" ON public.order_audit_logs;
CREATE POLICY "Admins can view order audit logs"
ON public.order_audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 2) Trigger function to log every order status change
CREATE OR REPLACE FUNCTION public.audit_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_actor_role TEXT;
BEGIN
  BEGIN
    v_actor_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_user_id := NULL;
  END;

  BEGIN
    v_actor_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_actor_role := NULL;
  END;

  INSERT INTO public.order_audit_logs (
    event_type,
    order_id,
    vendor_id,
    cyclist_id,
    previous_status,
    new_status,
    actor_user_id,
    actor_role,
    source,
    settlement_context
  )
  VALUES (
    'order_status_changed',
    NEW.id,
    NEW.vendor_id,
    NEW.cyclist_id,
    OLD.status,
    NEW.status,
    v_actor_user_id,
    v_actor_role,
    'orders.status.trigger',
    jsonb_build_object(
      'payment_method', NEW.payment_method,
      'vendor_settlement_status_before', OLD.vendor_settlement_status,
      'vendor_settlement_status_after', NEW.vendor_settlement_status
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_order_status_change ON public.orders;
CREATE TRIGGER trg_audit_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.audit_order_status_change();

-- 3) Extend settlement function to log each settlement operation (batch-level)
CREATE OR REPLACE FUNCTION public.confirm_cash_transferred_to_vendor(p_cyclist_id uuid, p_vendor_id uuid)
 RETURNS TABLE(settled_orders_count integer, total_cash_received_added numeric, vendor_earnings_added numeric, platform_dues_added numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settled_orders_count integer := 0;
  v_total_cash_received_added numeric(12,2) := 0;
  v_vendor_earnings_added numeric(12,2) := 0;
  v_platform_dues_added numeric(12,2) := 0;
  v_actor_user_id UUID;
  v_actor_role TEXT;
BEGIN
  BEGIN
    v_actor_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_user_id := NULL;
  END;

  BEGIN
    v_actor_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_actor_role := NULL;
  END;

  WITH candidate_rows AS (
    SELECT id
    FROM public.orders
    WHERE cyclist_id = p_cyclist_id
      AND vendor_id = p_vendor_id
      AND payment_method = 'COD'
      AND status = 'delivered_cash_with_cyclist'
      AND vendor_settlement_status = 'pending'
    FOR UPDATE
  ), update_orders AS (
    UPDATE public.orders o
    SET
      status = 'cash_transferred_to_vendor',
      vendor_settlement_status = 'settled',
      updated_at = now()
    FROM candidate_rows c
    WHERE o.id = c.id
      AND o.cyclist_id = p_cyclist_id
      AND o.vendor_id = p_vendor_id
      AND o.payment_method = 'COD'
      AND o.status = 'delivered_cash_with_cyclist'
      AND o.vendor_settlement_status = 'pending'
    RETURNING
      o.id,
      COALESCE(o.total_price, 0) AS total_price,
      COALESCE(o.vendor_revenue, 0) AS vendor_revenue,
      COALESCE(o.platform_profit, 0) AS platform_profit
  )
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(u.total_price), 0),
    COALESCE(SUM(u.vendor_revenue), 0),
    COALESCE(SUM(u.platform_profit), 0)
  INTO v_settled_orders_count, v_total_cash_received_added, v_vendor_earnings_added, v_platform_dues_added
  FROM update_orders u;

  INSERT INTO public.order_audit_logs (
    event_type,
    vendor_id,
    cyclist_id,
    actor_user_id,
    actor_role,
    source,
    settlement_context
  )
  VALUES (
    'settlement_batch_processed',
    p_vendor_id,
    p_cyclist_id,
    v_actor_user_id,
    v_actor_role,
    'confirm_cash_transferred_to_vendor',
    jsonb_build_object(
      'settled_orders_count', v_settled_orders_count,
      'total_cash_received_added', ROUND(v_total_cash_received_added::numeric, 2),
      'vendor_earnings_added', ROUND(v_vendor_earnings_added::numeric, 2),
      'platform_dues_added', ROUND(v_platform_dues_added::numeric, 2)
    )
  );

  IF v_settled_orders_count = 0 THEN
    settled_orders_count := 0;
    total_cash_received_added := 0;
    vendor_earnings_added := 0;
    platform_dues_added := 0;
    RETURN NEXT;
  END IF;

  UPDATE public.vendors
  SET
    total_cash_received = COALESCE(total_cash_received, 0) + v_total_cash_received_added,
    vendor_earnings = COALESCE(vendor_earnings, 0) + v_vendor_earnings_added,
    platform_dues = COALESCE(platform_dues, 0) + v_platform_dues_added,
    updated_at = now()
  WHERE id = p_vendor_id;

  settled_orders_count := v_settled_orders_count;
  total_cash_received_added := ROUND(v_total_cash_received_added::numeric, 2);
  vendor_earnings_added := ROUND(v_vendor_earnings_added::numeric, 2);
  platform_dues_added := ROUND(v_platform_dues_added::numeric, 2);
  RETURN NEXT;
END;
$function$;