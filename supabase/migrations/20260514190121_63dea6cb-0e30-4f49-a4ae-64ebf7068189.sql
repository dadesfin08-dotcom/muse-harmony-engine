DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'carnet_transaction_type'
      AND e.enumlabel = 'CREDIT_CANCELLED'
  ) THEN
    ALTER TYPE public.carnet_transaction_type ADD VALUE 'CREDIT_CANCELLED';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_carnet_order_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_total numeric(12,2) := 0;
  v_vendor_carnet_id uuid;
  v_total_issued numeric(12,2) := 0;
  v_total_repaid numeric(12,2) := 0;
  v_new_debt numeric(12,2) := 0;
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

  IF v_vendor_carnet_id IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(o.total_price, 0) + COALESCE(o.delivery_fee, 0)), 0)
    INTO v_total_issued
    FROM public.orders o
    WHERE o.vendor_id = NEW.vendor_id
      AND o.customer_phone = NEW.customer_phone
      AND o.payment_method = 'Carnet'
      AND o.status <> 'cancelled';

    SELECT COALESCE(SUM(cp.amount), 0)
    INTO v_total_repaid
    FROM public.carnet_payments cp
    JOIN public.vendor_carnet vc ON vc.id = cp.vendor_carnet_id
    WHERE cp.vendor_id = NEW.vendor_id
      AND vc.customer_phone = NEW.customer_phone;

    v_new_debt := round(GREATEST(v_total_issued - v_total_repaid, 0)::numeric, 2);

    UPDATE public.vendor_carnet vc
    SET current_debt = v_new_debt,
        updated_at = now()
    WHERE vc.id = v_vendor_carnet_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_carnet_order_cancellation ON public.orders;

CREATE TRIGGER trg_handle_carnet_order_cancellation
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_carnet_order_cancellation();