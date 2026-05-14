CREATE OR REPLACE FUNCTION public.record_vendor_carnet_payment(p_vendor_id uuid, p_customer_phone text, p_amount numeric)
RETURNS TABLE(payment_id uuid, remaining_debt numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_carnet_id uuid;
  v_total_issued numeric(12,2) := 0;
  v_total_repaid numeric(12,2) := 0;
  v_dynamic_debt numeric(12,2) := 0;
  v_new_remaining numeric(12,2) := 0;
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
  into v_total_repaid
  from public.carnet_payments cp
  join public.vendor_carnet vc on vc.id = cp.vendor_carnet_id
  where cp.vendor_id = p_vendor_id
    and vc.customer_phone = p_customer_phone;

  v_dynamic_debt := round(greatest(v_total_issued - v_total_repaid, 0)::numeric, 2);

  if p_amount > v_dynamic_debt + 0.01 then
    raise exception 'Payment amount exceeds current debt';
  end if;

  insert into public.carnet_payments (vendor_id, vendor_carnet_id, amount)
  values (p_vendor_id, v_carnet_id, p_amount)
  returning id into payment_id;

  v_new_remaining := round(greatest(v_dynamic_debt - p_amount, 0)::numeric, 2);

  update public.vendor_carnet vc
  set current_debt = v_new_remaining,
      updated_at = now()
  where vc.id = v_carnet_id;

  remaining_debt := v_new_remaining;
  return next;
end;
$function$;