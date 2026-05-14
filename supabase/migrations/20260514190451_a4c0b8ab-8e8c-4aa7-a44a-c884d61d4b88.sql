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
$$;