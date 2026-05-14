do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'carnet_transaction_type'
      and n.nspname = 'public'
  ) then
    create type public.carnet_transaction_type as enum ('CREDIT_ISSUED', 'CREDIT_REPAID');
  end if;
end
$$;

create table if not exists public.carnet_transactions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_carnet_id uuid references public.vendor_carnet(id) on delete set null,
  customer_phone text not null,
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.carnet_payments(id) on delete set null,
  transaction_type public.carnet_transaction_type not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_carnet_transactions_vendor_created
  on public.carnet_transactions(vendor_id, created_at desc);

create index if not exists idx_carnet_transactions_vendor_type_created
  on public.carnet_transactions(vendor_id, transaction_type, created_at desc);

create unique index if not exists uq_carnet_transactions_order_issued
  on public.carnet_transactions(order_id, transaction_type)
  where order_id is not null and transaction_type = 'CREDIT_ISSUED';

create unique index if not exists uq_carnet_transactions_payment_repaid
  on public.carnet_transactions(payment_id, transaction_type)
  where payment_id is not null and transaction_type = 'CREDIT_REPAID';

alter table public.carnet_transactions enable row level security;

drop policy if exists "No direct access to carnet transactions" on public.carnet_transactions;
create policy "No direct access to carnet transactions"
on public.carnet_transactions
for all
using (false)
with check (false);

insert into public.carnet_transactions (
  vendor_id,
  customer_phone,
  order_id,
  transaction_type,
  amount,
  created_at,
  metadata
)
select
  o.vendor_id,
  coalesce(o.customer_phone, ''),
  o.id,
  'CREDIT_ISSUED'::public.carnet_transaction_type,
  round((coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0))::numeric, 2),
  coalesce(o.delivered_at, o.created_at, now()),
  jsonb_build_object('source', 'orders_backfill', 'status', o.status)
from public.orders o
where o.payment_method = 'Carnet'
  and o.vendor_id is not null
  and coalesce(o.customer_phone, '') <> ''
  and o.status in ('delivered', 'delivered_cash_with_cyclist', 'cash_transferred_to_vendor')
on conflict do nothing;

insert into public.carnet_transactions (
  vendor_id,
  vendor_carnet_id,
  customer_phone,
  payment_id,
  transaction_type,
  amount,
  created_at,
  metadata
)
select
  cp.vendor_id,
  cp.vendor_carnet_id,
  coalesce(vc.customer_phone, ''),
  cp.id,
  'CREDIT_REPAID'::public.carnet_transaction_type,
  round(coalesce(cp.amount, 0)::numeric, 2),
  coalesce(cp.created_at, now()),
  jsonb_build_object('source', 'payments_backfill')
from public.carnet_payments cp
left join public.vendor_carnet vc on vc.id = cp.vendor_carnet_id
where cp.vendor_id is not null
  and coalesce(vc.customer_phone, '') <> ''
on conflict do nothing;

create or replace function public.sync_carnet_credit_issued_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_method = 'Carnet'
     and new.vendor_id is not null
     and coalesce(new.customer_phone, '') <> ''
     and new.status in ('delivered', 'delivered_cash_with_cyclist', 'cash_transferred_to_vendor') then
    insert into public.carnet_transactions (
      vendor_id,
      customer_phone,
      order_id,
      transaction_type,
      amount,
      created_at,
      metadata
    )
    values (
      new.vendor_id,
      new.customer_phone,
      new.id,
      'CREDIT_ISSUED'::public.carnet_transaction_type,
      round((coalesce(new.total_price, 0) + coalesce(new.delivery_fee, 0))::numeric, 2),
      coalesce(new.delivered_at, new.created_at, now()),
      jsonb_build_object('source', 'orders_trigger', 'status', new.status)
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.sync_carnet_credit_repaid_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_phone text;
begin
  select vc.customer_phone
  into v_customer_phone
  from public.vendor_carnet vc
  where vc.id = new.vendor_carnet_id;

  if coalesce(v_customer_phone, '') <> '' then
    insert into public.carnet_transactions (
      vendor_id,
      vendor_carnet_id,
      customer_phone,
      payment_id,
      transaction_type,
      amount,
      created_at,
      metadata
    )
    values (
      new.vendor_id,
      new.vendor_carnet_id,
      v_customer_phone,
      new.id,
      'CREDIT_REPAID'::public.carnet_transaction_type,
      round(coalesce(new.amount, 0)::numeric, 2),
      coalesce(new.created_at, now()),
      jsonb_build_object('source', 'payments_trigger')
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_sync_carnet_credit_issued on public.orders;
create trigger trg_orders_sync_carnet_credit_issued
after insert or update on public.orders
for each row
execute function public.sync_carnet_credit_issued_from_order();

drop trigger if exists trg_carnet_payments_sync_repaid on public.carnet_payments;
create trigger trg_carnet_payments_sync_repaid
after insert on public.carnet_payments
for each row
execute function public.sync_carnet_credit_repaid_from_payment();