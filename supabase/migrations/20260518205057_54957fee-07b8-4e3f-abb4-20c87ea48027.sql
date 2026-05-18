CREATE TYPE public.support_ticket_status AS ENUM ('open', 'resolved', 'closed', 'archived');
CREATE TYPE public.support_sender_type AS ENUM ('user', 'admin');
CREATE TYPE public.support_ticket_category AS ENUM (
  'order_problem',
  'payment_problem',
  'delivery_delay',
  'product_quality',
  'refund_request',
  'technical_issue',
  'other'
);

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category public.support_ticket_category NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  last_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type public.support_sender_type NOT NULL,
  sender_id UUID,
  message TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_status_created
  ON public.support_tickets (user_id, status, created_at DESC);
CREATE INDEX idx_support_tickets_last_reply_at
  ON public.support_tickets (last_reply_at DESC NULLS LAST, created_at DESC);
CREATE INDEX idx_support_messages_ticket_created
  ON public.support_messages (ticket_id, created_at ASC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own support tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own support tickets"
ON public.support_tickets
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all support tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all support tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view messages on own tickets"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages on own tickets"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'user'
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all support messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create support messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND sender_type = 'admin');

CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_support_ticket_last_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
  SET
    last_reply_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_support_tickets_updated_at();

CREATE TRIGGER trg_support_messages_bump_ticket
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_support_ticket_last_reply();

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;