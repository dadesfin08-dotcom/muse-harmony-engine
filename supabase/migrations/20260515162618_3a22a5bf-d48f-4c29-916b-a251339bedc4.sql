DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'order_category'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.order_category AS ENUM ('MARKETPLACE', 'PLATFORM_SUBSCRIPTION');
  END IF;
END
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_category public.order_category NOT NULL DEFAULT 'MARKETPLACE';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cash_to_collect_from_customer numeric NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ALTER COLUMN vendor_id DROP NOT NULL;

UPDATE public.orders
SET order_category = 'MARKETPLACE'
WHERE order_category IS NULL;

UPDATE public.orders
SET cash_to_collect_from_customer = CASE
  WHEN COALESCE(order_category::text, 'MARKETPLACE') = 'PLATFORM_SUBSCRIPTION' THEN 0
  WHEN payment_method = 'COD'::public.payment_method THEN COALESCE(total_price, 0)
  ELSE 0
END;

CREATE TABLE IF NOT EXISTS public.platform_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_fr text,
  name_ar text,
  description text,
  price_per_unit numeric NOT NULL DEFAULT 0,
  unit_type text NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_packs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_packs'
      AND policyname = 'Admins can view platform packs'
  ) THEN
    CREATE POLICY "Admins can view platform packs"
      ON public.platform_packs
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_packs'
      AND policyname = 'Admins can create platform packs'
  ) THEN
    CREATE POLICY "Admins can create platform packs"
      ON public.platform_packs
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_packs'
      AND policyname = 'Admins can update platform packs'
  ) THEN
    CREATE POLICY "Admins can update platform packs"
      ON public.platform_packs
      FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_packs'
      AND policyname = 'Admins can delete platform packs'
  ) THEN
    CREATE POLICY "Admins can delete platform packs"
      ON public.platform_packs
      FOR DELETE
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_platform_packs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_packs_updated_at ON public.platform_packs;
CREATE TRIGGER trg_platform_packs_updated_at
BEFORE UPDATE ON public.platform_packs
FOR EACH ROW
EXECUTE FUNCTION public.set_platform_packs_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_order_category_isolation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_category = 'PLATFORM_SUBSCRIPTION'::public.order_category THEN
    NEW.vendor_id := NULL;
    NEW.cash_to_collect_from_customer := 0;
  ELSE
    NEW.cash_to_collect_from_customer := CASE
      WHEN NEW.payment_method = 'COD'::public.payment_method THEN COALESCE(NEW.total_price, 0)
      ELSE 0
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enforce_category_isolation ON public.orders;
CREATE TRIGGER trg_orders_enforce_category_isolation
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_category_isolation();

CREATE OR REPLACE FUNCTION public.recompute_vendor_carnet_customer_debt(p_vendor_id uuid, p_customer_phone text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_carnet_id uuid;
  v_total_issued numeric(12,2) := 0;
  v_total_repaid numeric(12,2) := 0;
  v_new_debt numeric(12,2) := 0;
BEGIN
  SELECT vc.id
  INTO v_vendor_carnet_id
  FROM public.vendor_carnet vc
  WHERE vc.vendor_id = p_vendor_id
    AND vc.customer_phone = p_customer_phone
  ORDER BY vc.updated_at DESC
  LIMIT 1;

  IF v_vendor_carnet_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(COALESCE(o.total_price, 0) + COALESCE(o.delivery_fee, 0)), 0)
  INTO v_total_issued
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND o.customer_phone = p_customer_phone
    AND o.payment_method = 'Carnet'
    AND COALESCE(o.order_category::text, 'MARKETPLACE') <> 'PLATFORM_SUBSCRIPTION'
    AND o.status <> 'cancelled';

  SELECT COALESCE(SUM(cp.amount), 0)
  INTO v_total_repaid
  FROM public.carnet_payments cp
  JOIN public.vendor_carnet vc ON vc.id = cp.vendor_carnet_id
  WHERE cp.vendor_id = p_vendor_id
    AND vc.customer_phone = p_customer_phone;

  v_new_debt := round(GREATEST(v_total_issued - v_total_repaid, 0)::numeric, 2);

  UPDATE public.vendor_carnet vc
  SET current_debt = v_new_debt,
      updated_at = now()
  WHERE vc.id = v_vendor_carnet_id;

  RETURN v_new_debt;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_carnet_credit_issued_from_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean := false;
BEGIN
  IF NEW.payment_method = 'Carnet'
     AND COALESCE(NEW.order_category::text, 'MARKETPLACE') <> 'PLATFORM_SUBSCRIPTION'
     AND NEW.vendor_id IS NOT NULL
     AND COALESCE(NEW.customer_phone, '') <> ''
     AND NEW.status IN ('delivered', 'delivered_cash_with_cyclist', 'cash_transferred_to_vendor') THEN

    SELECT EXISTS (
      SELECT 1
      FROM public.carnet_transactions ct
      WHERE ct.order_id = NEW.id
        AND ct.transaction_type = 'CREDIT_ISSUED'::public.carnet_transaction_type
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.carnet_transactions (
        vendor_id,
        customer_phone,
        order_id,
        transaction_type,
        amount,
        created_at,
        metadata
      )
      VALUES (
        NEW.vendor_id,
        NEW.customer_phone,
        NEW.id,
        'CREDIT_ISSUED'::public.carnet_transaction_type,
        round((COALESCE(NEW.total_price, 0) + COALESCE(NEW.delivery_fee, 0))::numeric, 2),
        COALESCE(NEW.delivered_at, NEW.created_at, now()),
        jsonb_build_object('source', 'orders_trigger', 'status', NEW.status)
      );
    END IF;

    PERFORM public.recompute_vendor_carnet_customer_debt(NEW.vendor_id, NEW.customer_phone);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_carnet_order_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_total numeric(12,2) := 0;
  v_vendor_carnet_id uuid;
  v_cancel_exists boolean := false;
BEGIN
  IF NEW.payment_method <> 'Carnet' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.order_category::text, 'MARKETPLACE') = 'PLATFORM_SUBSCRIPTION' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.vendor_id IS NULL OR COALESCE(NEW.customer_phone, '') = '' THEN
    RETURN NEW;
  END IF;

  v_order_total := round((COALESCE(NEW.total_price, 0) + COALESCE(NEW.delivery_fee, 0))::numeric, 2);

  SELECT vc.id
  INTO v_vendor_carnet_id
  FROM public.vendor_carnet vc
  WHERE vc.vendor_id = NEW.vendor_id
    AND vc.customer_phone = NEW.customer_phone
  ORDER BY vc.updated_at DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.carnet_transactions ct
    WHERE ct.order_id = NEW.id
      AND ct.transaction_type = 'CREDIT_CANCELLED'::public.carnet_transaction_type
  )
  INTO v_cancel_exists;

  IF NOT v_cancel_exists THEN
    INSERT INTO public.carnet_transactions (
      vendor_id,
      vendor_carnet_id,
      customer_phone,
      order_id,
      transaction_type,
      amount,
      created_at,
      metadata
    )
    VALUES (
      NEW.vendor_id,
      v_vendor_carnet_id,
      NEW.customer_phone,
      NEW.id,
      'CREDIT_CANCELLED'::public.carnet_transaction_type,
      v_order_total,
      now(),
      jsonb_build_object(
        'source', 'order_cancellation_trigger',
        'previous_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  PERFORM public.recompute_vendor_carnet_customer_debt(NEW.vendor_id, NEW.customer_phone);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_carnet_payment_to_vendor_wallets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer_phone text;
  v_total_repaid_before numeric(12,2) := 0;
  v_target_before numeric(12,2) := 0;
  v_target_after numeric(12,2) := 0;
  v_gross numeric(12,2) := 0;
  v_vendor_revenue numeric(12,2) := 0;
  v_platform_markup numeric(12,2) := 0;
  v_alloc_before numeric(12,2) := 0;
  v_alloc_after numeric(12,2) := 0;
  v_was_fully_settled boolean := false;
  v_is_fully_settled boolean := false;
  v_vendor_delta numeric(12,2) := 0;
  v_platform_delta numeric(12,2) := 0;
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

  for v_gross, v_vendor_revenue, v_platform_markup in
    select
      greatest(round((coalesce(o.total_price, 0) + coalesce(o.delivery_fee, 0))::numeric, 2), 0) as gross,
      greatest(round(coalesce(o.vendor_revenue, 0)::numeric, 2), 0) as vendor_revenue,
      greatest(round(coalesce(o.platform_markup, o.platform_profit, 0)::numeric, 2), 0) as platform_markup
    from public.orders o
    where o.vendor_id = new.vendor_id
      and o.customer_phone = v_customer_phone
      and o.payment_method = 'Carnet'
      and coalesce(o.order_category::text, 'MARKETPLACE') <> 'PLATFORM_SUBSCRIPTION'
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

    if (not v_was_fully_settled) and v_is_fully_settled then
      v_vendor_delta := v_vendor_delta + v_vendor_revenue;
      v_platform_delta := v_platform_delta + v_platform_markup;
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_platform_commission_ledger_from_carnet_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and coalesce(o.order_category::text, 'MARKETPLACE') <> 'PLATFORM_SUBSCRIPTION'
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_platform_commission_ledger_from_cash_transfer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_markup numeric(12,2);
begin
  if new.status <> 'cash_transferred_to_vendor' then
    return new;
  end if;

  if old.status = 'cash_transferred_to_vendor' then
    return new;
  end if;

  if coalesce(new.order_category::text, 'MARKETPLACE') = 'PLATFORM_SUBSCRIPTION' then
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
$function$;