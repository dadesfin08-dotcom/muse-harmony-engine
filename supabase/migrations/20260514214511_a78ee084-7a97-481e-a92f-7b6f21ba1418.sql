CREATE OR REPLACE FUNCTION public.confirm_cash_transferred_to_vendor(
  p_cyclist_id uuid,
  p_vendor_id uuid
)
RETURNS TABLE(
  settled_orders_count integer,
  total_cash_received_added numeric,
  vendor_earnings_added numeric,
  platform_dues_added numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_settled_orders_count integer := 0;
  v_total_cash_received_added numeric(12,2) := 0;
  v_vendor_earnings_added numeric(12,2) := 0;
  v_platform_dues_added numeric(12,2) := 0;
begin
  with candidate_rows as (
    select
      id,
      coalesce(total_price, 0) as total_price,
      coalesce(vendor_revenue, 0) as vendor_revenue,
      coalesce(platform_profit, 0) as platform_profit
    from public.orders
    where cyclist_id = p_cyclist_id
      and vendor_id = p_vendor_id
      and payment_method = 'COD'
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
    coalesce((select sum(c.total_price) from candidate_rows c), 0),
    coalesce((select sum(c.vendor_revenue) from candidate_rows c), 0),
    coalesce((select sum(c.platform_profit) from candidate_rows c), 0)
  into v_settled_orders_count, v_total_cash_received_added, v_vendor_earnings_added, v_platform_dues_added;

  if v_settled_orders_count = 0 then
    settled_orders_count := 0;
    total_cash_received_added := 0;
    vendor_earnings_added := 0;
    platform_dues_added := 0;
    return next;
  end if;

  update public.vendors
  set
    total_cash_received = coalesce(total_cash_received, 0) + v_total_cash_received_added,
    vendor_earnings = coalesce(vendor_earnings, 0) + v_vendor_earnings_added,
    platform_dues = coalesce(platform_dues, 0) + v_platform_dues_added,
    updated_at = now()
  where id = p_vendor_id;

  settled_orders_count := v_settled_orders_count;
  total_cash_received_added := round(v_total_cash_received_added::numeric, 2);
  vendor_earnings_added := round(v_vendor_earnings_added::numeric, 2);
  platform_dues_added := round(v_platform_dues_added::numeric, 2);
  return next;
end;
$function$;