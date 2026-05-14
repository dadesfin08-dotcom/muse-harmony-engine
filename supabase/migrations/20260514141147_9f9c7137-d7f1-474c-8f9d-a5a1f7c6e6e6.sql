create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = 'admin'
  );
$$;

alter table public.categories
  add column if not exists apply_platform_markup boolean not null default true;

alter table public.master_products
  add column if not exists apply_platform_markup boolean not null default true;

alter table public.vendors
  add column if not exists vendor_earnings numeric(12,2) not null default 0,
  add column if not exists platform_dues numeric(12,2) not null default 0;

alter table public.orders
  add column if not exists subtotal_base_price numeric(12,2) not null default 0,
  add column if not exists platform_profit numeric(12,2) not null default 0,
  add column if not exists vendor_revenue numeric(12,2) not null default 0;

create table if not exists public.platform_collections (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount numeric(12,2) not null,
  collected_by_user_id uuid references public.profiles(id) on delete set null,
  qr_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_collections_vendor_created
  on public.platform_collections(vendor_id, created_at desc);

alter table public.platform_collections enable row level security;

drop policy if exists "Admins view platform collections" on public.platform_collections;
create policy "Admins view platform collections"
on public.platform_collections
for select
using (public.is_admin(auth.uid()));

drop policy if exists "Admins insert platform collections" on public.platform_collections;
create policy "Admins insert platform collections"
on public.platform_collections
for insert
with check (public.is_admin(auth.uid()));

create or replace function public.complete_delivery_and_apply_payment(p_cyclist_id uuid, p_order_id uuid)
returns table(order_id uuid, new_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_method public.payment_method;
  v_vendor_id uuid;
  v_customer_phone text;
  v_total numeric(12,2);
  v_vendor_revenue numeric(12,2);
  v_platform_profit numeric(12,2);
begin
  update public.orders
  set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = p_order_id
    and cyclist_id = p_cyclist_id
    and status in ('ready', 'delivering')
  returning
    payment_method,
    vendor_id,
    customer_phone,
    (total_price + delivery_fee),
    coalesce(vendor_revenue, greatest(total_price - delivery_fee, 0)),
    coalesce(platform_profit, 0)
  into v_payment_method, v_vendor_id, v_customer_phone, v_total, v_vendor_revenue, v_platform_profit;

  if not found then
    raise exception 'Order not found or not assignable';
  end if;

  update public.vendors
  set
    vendor_earnings = coalesce(vendor_earnings, 0) + coalesce(v_vendor_revenue, 0),
    platform_dues = coalesce(platform_dues, 0) + case when v_payment_method = 'COD' then coalesce(v_platform_profit, 0) else 0 end,
    updated_at = now()
  where id = v_vendor_id;

  if v_payment_method = 'Carnet' then
    insert into public.vendor_carnet (vendor_id, customer_phone, current_debt, max_limit)
    values (v_vendor_id, v_customer_phone, v_total, 0)
    on conflict (vendor_id, customer_phone)
    do update set
      current_debt = public.vendor_carnet.current_debt + excluded.current_debt,
      updated_at = now();
  end if;

  return query select p_order_id, 'delivered'::text;
end;
$$;

create or replace function public.collect_platform_dues(
  p_vendor_id uuid,
  p_amount numeric,
  p_qr_payload jsonb default null,
  p_collected_by_user_id uuid default null
)
returns table(transaction_id uuid, collected_amount numeric, remaining_dues numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_dues numeric(12,2);
  v_tx_id uuid;
  v_is_service_role boolean;
begin
  v_is_service_role := current_user = 'service_role';

  if not v_is_service_role and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can collect platform dues';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Collection amount must be greater than zero';
  end if;

  select coalesce(platform_dues, 0)
  into v_current_dues
  from public.vendors
  where id = p_vendor_id
  for update;

  if v_current_dues is null then
    raise exception 'Vendor not found';
  end if;

  if p_amount > v_current_dues + 0.01 then
    raise exception 'Collection amount exceeds current platform dues';
  end if;

  update public.vendors
  set
    platform_dues = greatest(0, coalesce(platform_dues, 0) - p_amount),
    updated_at = now()
  where id = p_vendor_id
  returning platform_dues into remaining_dues;

  insert into public.platform_collections(vendor_id, amount, collected_by_user_id, qr_payload)
  values (p_vendor_id, p_amount, p_collected_by_user_id, p_qr_payload)
  returning id into v_tx_id;

  transaction_id := v_tx_id;
  collected_amount := round(p_amount::numeric, 2);
  remaining_dues := round(coalesce(remaining_dues, 0)::numeric, 2);
  return next;
end;
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_admin(uuid) from anon;
revoke all on function public.is_admin(uuid) from authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;

revoke all on function public.collect_platform_dues(uuid, numeric, jsonb, uuid) from public;
revoke all on function public.collect_platform_dues(uuid, numeric, jsonb, uuid) from anon;
revoke all on function public.collect_platform_dues(uuid, numeric, jsonb, uuid) from authenticated;
grant execute on function public.collect_platform_dues(uuid, numeric, jsonb, uuid) to service_role;

grant all on table public.platform_collections to service_role;