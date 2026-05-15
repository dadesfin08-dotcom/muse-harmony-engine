alter table public.platform_commission_ledger
  drop constraint if exists platform_commission_ledger_vendor_id_fkey;

alter table public.platform_commission_ledger
  add constraint platform_commission_ledger_vendor_id_fkey
  foreign key (vendor_id)
  references public.vendors(id)
  on delete cascade;

drop policy if exists "Vendors can view their own platform commission ledger" on public.platform_commission_ledger;
drop policy if exists "Vendors can insert own withdrawal rows" on public.platform_commission_ledger;

create policy "Vendors can view their own platform commission ledger"
  on public.platform_commission_ledger
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.vendors v
      where v.id = platform_commission_ledger.vendor_id
        and v.user_id = auth.uid()
    )
  );

create policy "Vendors can insert own withdrawal rows"
  on public.platform_commission_ledger
  for insert
  to authenticated
  with check (
    transaction_type = 'WITHDRAWAL'::public.platform_commission_transaction_type
    and amount < 0
    and exists (
      select 1
      from public.vendors v
      where v.id = platform_commission_ledger.vendor_id
        and v.user_id = auth.uid()
    )
  );