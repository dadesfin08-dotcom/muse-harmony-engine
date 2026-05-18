ALTER TABLE public.support_messages
ADD COLUMN delivered_at TIMESTAMPTZ,
ADD COLUMN read_at TIMESTAMPTZ;

CREATE INDEX idx_support_messages_ticket_sender_delivery_read
  ON public.support_messages (ticket_id, sender_type, delivered_at, read_at, created_at);