create type public.platform_commission_transaction_type as enum ('ACCRUAL', 'WITHDRAWAL');

create table public.platform_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  transaction_type public.platform_commission_transaction_type not null,
  amount numeric(12,2) not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint platform_commission_ledger_amount_direction_chk check (
    (transaction_type = 'ACCRUAL' and amount > 0)
    or
    (transaction_type = 'WITHDRAWAL' and amount < 0)
  )
);

create unique index platform_commission_ledger_unique_accrual_per_order_idx
  on public.platform_commission_ledger(order_id)
  where transaction_type = 'ACCRUAL' and order_id is not null;

create index platform_commission_ledger_vendor_created_at_idx
  on public.platform_commission_ledger(vendor_id, created_at desc);

create index platform_commission_ledger_vendor_amount_idx
  on public.platform_commission_ledger(vendor_id, amount);

alter table public.platform_commission_ledger enable row level security;

create policy "Admins can view platform commission ledger"
  on public.platform_commission_ledger
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "Admins can insert platform commission ledger"
  on public.platform_commission_ledger
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Vendors can view their own platform commission ledger"
  on public.platform_commission_ledger
  for select
  to authenticated
  using (auth.uid() = vendor_id);

create policy "Vendors can insert own withdrawal rows"
  on public.platform_commission_ledger
  for insert
  to authenticated
  with check (
    auth.uid() = vendor_id
    and transaction_type = 'WITHDRAWAL'
    and amount < 0
  );