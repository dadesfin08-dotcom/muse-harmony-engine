DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'order_status'
      AND e.enumlabel = 'new'
  ) THEN
    ALTER TYPE public.order_status RENAME VALUE 'new' TO 'pending';
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'order_status'
      AND e.enumlabel = 'delivering'
  ) THEN
    ALTER TYPE public.order_status RENAME VALUE 'delivering' TO 'in_delivery';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.map_order_status_to_push_event(_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE lower(coalesce(_status, ''))
    WHEN 'pending' THEN 'ORDER_CREATED'
    WHEN 'preparing' THEN 'MERCHANT_ACCEPTED'
    WHEN 'ready' THEN 'ORDER_READY'
    WHEN 'in_delivery' THEN 'RIDER_PICKED_UP'
    WHEN 'delivered' THEN 'ORDER_COMPLETED'
    WHEN 'delivered_cash_with_cyclist' THEN 'ORDER_COMPLETED'
    WHEN 'cash_transferred_to_vendor' THEN 'ORDER_COMPLETED'
    ELSE 'STATUS_UPDATE'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_delivery_and_apply_payment(p_cyclist_id uuid, p_order_id uuid)
RETURNS TABLE(order_id uuid, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  update public.orders
  set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = p_order_id
    and cyclist_id = p_cyclist_id
    and status in ('ready', 'in_delivery')
  returning id into order_id;

  if not found then
    raise exception 'Order not found or not assignable';
  end if;

  new_status := 'delivered';
  return next;
end;
$function$;