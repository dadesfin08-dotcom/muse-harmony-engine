-- Recreate the carnet payment RPC to match the current schema
create or replace function public.record_vendor_carnet_payment(
  p_vendor_id uuid,
  p_customer_phone text,
  p_amount numeric
)
returns table(payment_id uuid, remaining_debt numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carnet_id uuid;
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
  limit 1;

  if v_carnet_id is null then
    raise exception 'Carnet customer not found';
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

revoke all on function public.record_vendor_carnet_payment(uuid, text, numeric) from public;
revoke all on function public.record_vendor_carnet_payment(uuid, text, numeric) from anon;
grant execute on function public.record_vendor_carnet_payment(uuid, text, numeric) to authenticated;
grant execute on function public.record_vendor_carnet_payment(uuid, text, numeric) to service_role;