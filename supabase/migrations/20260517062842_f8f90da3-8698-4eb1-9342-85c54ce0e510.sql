CREATE TABLE IF NOT EXISTS public.customer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('search', 'add_to_cart', 'remove_from_cart', 'checkout')),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts for tracking" ON public.customer_events;
CREATE POLICY "Allow public inserts for tracking"
ON public.customer_events
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view customer events" ON public.customer_events;
CREATE POLICY "Admins can view customer events"
ON public.customer_events
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_customer_events_created_at ON public.customer_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_events_event_type ON public.customer_events (event_type);
CREATE INDEX IF NOT EXISTS idx_customer_events_user_id ON public.customer_events (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_session_id ON public.customer_events (session_id);