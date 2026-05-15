ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS platform_markup numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.orders
SET platform_markup = round(coalesce(platform_markup, platform_profit, 0)::numeric, 2)
WHERE coalesce(platform_markup, 0) <> round(coalesce(platform_profit, 0)::numeric, 2);

CREATE OR REPLACE FUNCTION public.record_vendor_carnet_payment(
  p_vendor_id uuid,
  p_customer_phone text,
  p_amount numeric
)
RETURNS TABLE(payment_id uuid, remaining_debt numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_carnet_id uuid;
  v_total_issued numeric(12,2) := 0;
  v_total_repaid_before numeric(12,2) := 0;
  v_total_repaid_after numeric(12,2) := 0;
  v_dynamic_debt numeric(12,2) := 0;
  v_new_remaining numeric(12,2) := 0;
  v_target_before numeric(12,2) := 0;
  v_target_after numeric(12,2) := 0;
  v_gross numeric(12,2) := 0;
  v_vendor_revenue numeric(12,2) := 0;
  v_platform_markup numeric(12,2) := 0;
  v_alloc_before numeric(12,2) := 0;
  v_alloc_after numeric(12,2) := 0;
  v_was_fully_settled boolean := false;
  v_is_fully_settled boolean := false;
  v_vendor_delta numeric(12,2) := 0;
  v_platform_delta numeric(12,2) := 0;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select vc.id
  into v_carnet_id
  from public.vendor_carnet vc
  where vc.vendor_id = p_vendor_id
    and vc.customer_phone = p_customer_phone
  order by vc.updated_at desc
  limit 1
  for update;

  if v_carnet_id is null then
    raise exception 'Carnet customer not found';
  end if;

  select coalesce(sum(coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0)), 0)
  into v_total_issued
  from public.orders o
  where o.vendor_id = p_vendor_id
    and o.customer_phone = p_customer_phone
    and o.payment_method = 'Carnet'
    and o.status <> 'cancelled';

  select coalesce(sum(cp.amount), 0)
  into v_total_repaid_before
  from public.carnet_payments cp
  join public.vendor_carnet vc on vc.id = cp.vendor_carnet_id
  where cp.vendor_id = p_vendor_id
    and vc.customer_phone = p_customer_phone;

  v_dynamic_debt := round(greatest(v_total_issued - v_total_repaid_before, 0)::numeric, 2);

  if p_amount > v_dynamic_debt + 0.01 then
    raise exception 'Payment amount exceeds current debt';
  end if;

  insert into public.carnet_payments (vendor_id, vendor_carnet_id, amount)
  values (p_vendor_id, v_carnet_id, p_amount)
  returning id into payment_id;

  v_total_repaid_after := v_total_repaid_before + p_amount;
  v_new_remaining := round(greatest(v_total_issued - v_total_repaid_after, 0)::numeric, 2);

  update public.vendor_carnet vc
  set current_debt = v_new_remaining,
      updated_at = now()
  where vc.id = v_carnet_id;

  v_target_before := greatest(v_total_repaid_before, 0);
  v_target_after := greatest(v_total_repaid_after, 0);

  for v_gross, v_vendor_revenue, v_platform_markup in
    select
      greatest(round((coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0))::numeric, 2), 0) as gross,
      greatest(round(coalesce(o.vendor_revenue, 0)::numeric, 2), 0) as vendor_revenue,
      greatest(round(coalesce(o.platform_markup, o.platform_profit, 0)::numeric, 2), 0) as platform_markup
    from public.orders o
    where o.vendor_id = p_vendor_id
      and o.customer_phone = p_customer_phone
      and o.payment_method = 'Carnet'
      and o.status in ('delivered', 'delivered_cash_with_cyclist', 'cash_transferred_to_vendor')
    order by coalesce(o.delivered_at, o.created_at), o.id
  loop
    if v_gross <= 0 then
      continue;
    end if;

    v_alloc_before := least(v_gross, v_target_before);
    v_target_before := greatest(v_target_before - v_alloc_before, 0);

    v_alloc_after := least(v_gross, v_target_after);
    v_target_after := greatest(v_target_after - v_alloc_after, 0);

    v_was_fully_settled := v_alloc_before >= v_gross - 0.01;
    v_is_fully_settled := v_alloc_after >= v_gross - 0.01;

    if (not v_was_fully_settled) and v_is_fully_settled then
      v_vendor_delta := v_vendor_delta + v_vendor_revenue;
      v_platform_delta := v_platform_delta + v_platform_markup;
    end if;
  end loop;

  update public.vendors v
  set
    total_cash_received = coalesce(v.total_cash_received, 0) + round(coalesce(p_amount, 0)::numeric, 2),
    vendor_earnings = coalesce(v.vendor_earnings, 0) + round(v_vendor_delta::numeric, 2),
    platform_dues = coalesce(v.platform_dues, 0) + round(v_platform_delta::numeric, 2),
    updated_at = now()
  where v.id = p_vendor_id;

  remaining_debt := v_new_remaining;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_carnet_payment_to_vendor_wallets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_customer_phone text;
  v_total_repaid_before numeric(12,2) := 0;
  v_target_before numeric(12,2) := 0;
  v_target_after numeric(12,2) := 0;
  v_gross numeric(12,2) := 0;
  v_vendor_revenue numeric(12,2) := 0;
  v_platform_markup numeric(12,2) := 0;
  v_alloc_before numeric(12,2) := 0;
  v_alloc_after numeric(12,2) := 0;
  v_was_fully_settled boolean := false;
  v_is_fully_settled boolean := false;
  v_vendor_delta numeric(12,2) := 0;
  v_platform_delta numeric(12,2) := 0;
begin
  if new.amount is null or new.amount <= 0 then
    return new;
  end if;

  select vc.customer_phone
  into v_customer_phone
  from public.vendor_carnet vc
  where vc.id = new.vendor_carnet_id;

  if coalesce(v_customer_phone, '') = '' then
    return new;
  end if;

  select coalesce(sum(cp.amount), 0)
  into v_total_repaid_before
  from public.carnet_payments cp
  join public.vendor_carnet vc on vc.id = cp.vendor_carnet_id
  where cp.vendor_id = new.vendor_id
    and vc.customer_phone = v_customer_phone
    and cp.id <> new.id;

  v_target_before := greatest(v_total_repaid_before, 0);
  v_target_after := greatest(v_total_repaid_before + coalesce(new.amount, 0), 0);

  for v_gross, v_vendor_revenue, v_platform_markup in
    select
      greatest(round((coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0))::numeric, 2), 0) as gross,
      greatest(round(coalesce(o.vendor_revenue, 0)::numeric, 2), 0) as vendor_revenue,
      greatest(round(coalesce(o.platform_markup, o.platform_profit, 0)::numeric, 2), 0) as platform_markup
    from public.orders o
    where o.vendor_id = new.vendor_id
      and o.customer_phone = v_customer_phone
      and o.payment_method = 'Carnet'
      and o.status in ('delivered', 'delivered_cash_with_cyclist', 'cash_transferred_to_vendor')
    order by coalesce(o.delivered_at, o.created_at), o.id
  loop
    if v_gross <= 0 then
      continue;
    end if;

    v_alloc_before := least(v_gross, v_target_before);
    v_target_before := greatest(v_target_before - v_alloc_before, 0);

    v_alloc_after := least(v_gross, v_target_after);
    v_target_after := greatest(v_target_after - v_alloc_after, 0);

    v_was_fully_settled := v_alloc_before >= v_gross - 0.01;
    v_is_fully_settled := v_alloc_after >= v_gross - 0.01;

    if (not v_was_fully_settled) and v_is_fully_settled then
      v_vendor_delta := v_vendor_delta + v_vendor_revenue;
      v_platform_delta := v_platform_delta + v_platform_markup;
    end if;
  end loop;

  update public.vendors v
  set
    total_cash_received = coalesce(v.total_cash_received, 0) + round(coalesce(new.amount, 0)::numeric, 2),
    vendor_earnings = coalesce(v.vendor_earnings, 0) + round(v_vendor_delta::numeric, 2),
    platform_dues = coalesce(v.platform_dues, 0) + round(v_platform_delta::numeric, 2),
    updated_at = now()
  where v.id = new.vendor_id;

  return new;
end;
$function$;