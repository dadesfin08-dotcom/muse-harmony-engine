create or replace function public.complete_delivery_and_apply_payment(
  p_cyclist_id uuid,
  p_order_id uuid
)
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
begin
  update public.orders
  set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = p_order_id
    and cyclist_id = p_cyclist_id
    and status in ('ready', 'delivering')
  returning payment_method, vendor_id, customer_phone, (total_price + delivery_fee)
  into v_payment_method, v_vendor_id, v_customer_phone, v_total;

  if not found then
    raise exception 'Order not found or not assignable';
  end if;

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

revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from public;
revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from anon;
revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from authenticated;
grant execute on function public.complete_delivery_and_apply_payment(uuid, uuid) to service_role;