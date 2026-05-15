create or replace function public.sync_platform_commission_ledger_from_cash_transfer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_markup numeric(12,2);
begin
  if new.status <> 'cash_transferred_to_vendor' then
    return new;
  end if;

  if old.status = 'cash_transferred_to_vendor' then
    return new;
  end if;

  v_markup := round(
    greatest(
      coalesce(new.platform_markup, new.platform_profit, (coalesce(new.total_price, 0) - coalesce(new.subtotal_base_price, 0)), 0),
      0
    )::numeric,
    2
  );

  if v_markup <= 0 then
    return new;
  end if;

  insert into public.platform_commission_ledger (
    vendor_id,
    order_id,
    transaction_type,
    amount,
    created_by,
    created_at
  )
  values (
    new.vendor_id,
    new.id,
    'ACCRUAL'::public.platform_commission_transaction_type,
    v_markup,
    null,
    coalesce(new.updated_at, now())
  )
  on conflict (order_id) where transaction_type = 'ACCRUAL' and order_id is not null do nothing;

  return new;
end;
$$;

create trigger trg_sync_platform_commission_ledger_from_cash_transfer
after update of status on public.orders
for each row
execute function public.sync_platform_commission_ledger_from_cash_transfer();

create or replace function public.sync_platform_commission_ledger_from_carnet_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_phone text;
  v_total_repaid_before numeric(12,2) := 0;
  v_target_before numeric(12,2) := 0;
  v_target_after numeric(12,2) := 0;
  v_order_id uuid;
  v_gross numeric(12,2) := 0;
  v_platform_markup numeric(12,2) := 0;
  v_alloc_before numeric(12,2) := 0;
  v_alloc_after numeric(12,2) := 0;
  v_was_fully_settled boolean := false;
  v_is_fully_settled boolean := false;
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

  for v_order_id, v_gross, v_platform_markup in
    select
      o.id,
      greatest(round((coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0))::numeric, 2), 0) as gross,
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

    if (not v_was_fully_settled) and v_is_fully_settled and v_platform_markup > 0 then
      insert into public.platform_commission_ledger (
        vendor_id,
        order_id,
        transaction_type,
        amount,
        created_by,
        created_at
      )
      values (
        new.vendor_id,
        v_order_id,
        'ACCRUAL'::public.platform_commission_transaction_type,
        v_platform_markup,
        null,
        coalesce(new.created_at, now())
      )
      on conflict (order_id) where transaction_type = 'ACCRUAL' and order_id is not null do nothing;
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_sync_platform_commission_ledger_from_carnet_payment
after insert on public.carnet_payments
for each row
execute function public.sync_platform_commission_ledger_from_carnet_payment();