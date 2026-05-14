DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'order_status'
  ) THEN
    BEGIN
      ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered_cash_with_cyclist';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cash_transferred_to_vendor';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_delivery_and_apply_payment(p_cyclist_id uuid, p_order_id uuid)
 RETURNS TABLE(order_id uuid, new_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.orders
  set
    status = 'delivered_cash_with_cyclist',
    delivered_at = now(),
    vendor_settlement_status = 'pending',
    updated_at = now()
  where id = p_order_id
    and cyclist_id = p_cyclist_id
    and status in ('ready', 'delivering')
  returning id into order_id;

  if not found then
    raise exception 'Order not found or not assignable';
  end if;

  new_status := 'delivered_cash_with_cyclist';
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_cash_transferred_to_vendor(
  p_cyclist_id uuid,
  p_vendor_id uuid
)
 RETURNS TABLE(
  settled_orders_count integer,
  vendor_earnings_added numeric,
  platform_dues_added numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_settled_orders_count integer := 0;
  v_vendor_earnings_added numeric(12,2) := 0;
  v_platform_dues_added numeric(12,2) := 0;
begin
  with candidate_rows as (
    select id, coalesce(vendor_revenue, 0) as vendor_revenue, coalesce(platform_profit, 0) as platform_profit
    from public.orders
    where cyclist_id = p_cyclist_id
      and vendor_id = p_vendor_id
      and status = 'delivered_cash_with_cyclist'
      and vendor_settlement_status = 'pending'
    for update
  ), update_orders as (
    update public.orders o
    set
      status = 'cash_transferred_to_vendor',
      vendor_settlement_status = 'settled',
      updated_at = now()
    where o.id in (select id from candidate_rows)
    returning o.id
  )
  select
    coalesce((select count(*) from update_orders), 0),
    coalesce((select sum(c.vendor_revenue) from candidate_rows c), 0),
    coalesce((select sum(c.platform_profit) from candidate_rows c), 0)
  into v_settled_orders_count, v_vendor_earnings_added, v_platform_dues_added;

  if v_settled_orders_count = 0 then
    raise exception 'No pending delivered cash orders found for this cyclist and vendor';
  end if;

  update public.vendors
  set
    vendor_earnings = coalesce(vendor_earnings, 0) + v_vendor_earnings_added,
    platform_dues = coalesce(platform_dues, 0) + v_platform_dues_added,
    updated_at = now()
  where id = p_vendor_id;

  settled_orders_count := v_settled_orders_count;
  vendor_earnings_added := round(v_vendor_earnings_added::numeric, 2);
  platform_dues_added := round(v_platform_dues_added::numeric, 2);
  return next;
end;
$function$;

REVOKE ALL ON FUNCTION public.confirm_cash_transferred_to_vendor(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.confirm_cash_transferred_to_vendor(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_cash_transferred_to_vendor(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cash_transferred_to_vendor(uuid, uuid) TO service_role;