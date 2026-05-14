create or replace function public.record_vendor_carnet_payment(p_vendor_id uuid, p_customer_phone text, p_amount numeric)
returns table(payment_id uuid, remaining_debt numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carnet_id uuid;
  v_current_debt numeric(12,2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select vc.id, coalesce(vc.current_debt, 0)
  into v_carnet_id, v_current_debt
  from public.vendor_carnet vc
  where vc.vendor_id = p_vendor_id
    and vc.customer_phone = p_customer_phone
  order by vc.updated_at desc
  limit 1
  for update;

  if v_carnet_id is null then
    raise exception 'Carnet customer not found';
  end if;

  if p_amount > v_current_debt + 0.01 then
    raise exception 'Payment amount exceeds current debt';
  end if;

  insert into public.carnet_payments (vendor_id, vendor_carnet_id, amount)
  values (p_vendor_id, v_carnet_id, p_amount)
  returning id into payment_id;

  update public.vendor_carnet vc
  set current_debt = greatest(0, vc.current_debt - p_amount),
      updated_at = now()
  where vc.id = v_carnet_id
  returning vc.current_debt into remaining_debt;

  return next;
end;
$$;

create or replace function public.apply_carnet_payment_to_vendor_wallets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_phone text;
  v_repaid_before numeric(12,2) := 0;
  v_target_before numeric(12,2) := 0;
  v_target_after numeric(12,2) := 0;
  v_vendor_delta numeric(12,2) := 0;
  v_platform_delta numeric(12,2) := 0;
  v_gross numeric(12,2);
  v_total_price numeric(12,2);
  v_vendor_revenue numeric(12,2);
  v_platform_profit numeric(12,2);
  v_alloc_before numeric(12,2);
  v_alloc_after numeric(12,2);
  v_delta_alloc numeric(12,2);
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
  into v_repaid_before
  from public.carnet_payments cp
  join public.vendor_carnet vc on vc.id = cp.vendor_carnet_id
  where cp.vendor_id = new.vendor_id
    and vc.customer_phone = v_customer_phone
    and cp.id <> new.id;

  v_target_before := greatest(v_repaid_before, 0);
  v_target_after := greatest(v_repaid_before + coalesce(new.amount, 0), 0);

  for v_gross, v_total_price, v_vendor_revenue, v_platform_profit in
    select
      greatest(round((coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0))::numeric, 2), 0) as gross,
      greatest(round(coalesce(o.total_price, 0)::numeric, 2), 0) as total_price,
      greatest(round(coalesce(o.vendor_revenue, 0)::numeric, 2), 0) as vendor_revenue,
      greatest(round(coalesce(o.platform_profit, 0)::numeric, 2), 0) as platform_profit
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

    v_delta_alloc := greatest(v_alloc_after - v_alloc_before, 0);

    if v_delta_alloc > 0 and v_total_price > 0 then
      v_vendor_delta := v_vendor_delta + (v_delta_alloc * (v_vendor_revenue / v_total_price));
      v_platform_delta := v_platform_delta + (v_delta_alloc * (v_platform_profit / v_total_price));
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
$$;

drop trigger if exists trg_carnet_payments_apply_wallet_split on public.carnet_payments;
create trigger trg_carnet_payments_apply_wallet_split
after insert on public.carnet_payments
for each row
execute function public.apply_carnet_payment_to_vendor_wallets();

create or replace function public.confirm_cash_transferred_to_vendor(p_cyclist_id uuid, p_vendor_id uuid)
returns table(settled_orders_count integer, total_cash_received_added numeric, vendor_earnings_added numeric, platform_dues_added numeric)
language plpgsql
security definer
set search_path = public
as $$
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
    raise exception 'No pending delivered cash orders found for this cyclist and vendor';
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
$$;