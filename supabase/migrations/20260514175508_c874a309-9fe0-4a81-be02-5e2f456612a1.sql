create or replace function public.complete_delivery_and_apply_payment(
  p_cyclist_id uuid,
  p_order_id uuid
)
returns table(order_id uuid, new_status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = p_order_id
    and cyclist_id = p_cyclist_id
    and status in ('ready', 'delivering')
  returning id into order_id;

  if not found then
    raise exception 'Order not found or not assignable';
  end if;

  new_status := 'delivered';
  return next;
end;
$$;

revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from public;
revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from anon;
revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from authenticated;
grant execute on function public.complete_delivery_and_apply_payment(uuid, uuid) to service_role;