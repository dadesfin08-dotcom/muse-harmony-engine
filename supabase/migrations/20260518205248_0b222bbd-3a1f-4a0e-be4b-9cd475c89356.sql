ALTER TABLE public.support_tickets
ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
ADD COLUMN last_sender_type public.support_sender_type;

CREATE INDEX idx_support_tickets_order_id
  ON public.support_tickets (order_id);

CREATE OR REPLACE FUNCTION public.bump_support_ticket_last_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
  SET
    last_reply_at = NEW.created_at,
    last_sender_type = NEW.sender_type,
    updated_at = now()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;