CREATE OR REPLACE FUNCTION public.recompute_vendor_carnet_customer_debt(p_vendor_id uuid, p_customer_phone text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.sync_carnet_credit_issued_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  IF NEW.payment_method = 'Carnet'
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
$$;

CREATE OR REPLACE FUNCTION public.handle_carnet_order_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_total numeric(12,2) := 0;
  v_vendor_carnet_id uuid;
  v_cancel_exists boolean := false;
BEGIN
  IF NEW.payment_method <> 'Carnet' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'cancelled' OR COALESCE(OLD.status, '') = 'cancelled' THEN
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
$$;

DROP TRIGGER IF EXISTS trg_sync_carnet_credit_issued_from_order_insert ON public.orders;
DROP TRIGGER IF EXISTS trg_sync_carnet_credit_issued_from_order_update ON public.orders;

CREATE TRIGGER trg_sync_carnet_credit_issued_from_order_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_carnet_credit_issued_from_order();

CREATE TRIGGER trg_sync_carnet_credit_issued_from_order_update
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_carnet_credit_issued_from_order();