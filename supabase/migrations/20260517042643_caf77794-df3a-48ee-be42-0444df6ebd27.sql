-- Deduplicate existing subscriptions before applying uniqueness
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, endpoint
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.push_subscriptions
)
DELETE FROM public.push_subscriptions ps
USING ranked r
WHERE ps.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_user_endpoint
  ON public.push_subscriptions (user_id, endpoint);

-- Enforce role domain expected by app logic
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_role_check;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_role_check
  CHECK (user_role IN ('customer', 'cyclist'));

-- Worker-safe claim function for concurrent processors
CREATE OR REPLACE FUNCTION public.claim_order_push_events(p_limit integer DEFAULT 25)
RETURNS SETOF public.order_push_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT e.id
    FROM public.order_push_events e
    WHERE e.processed_at IS NULL
      AND e.attempts < 10
      AND (
        e.processing_started_at IS NULL
        OR e.processing_started_at < now() - interval '2 minutes'
      )
    ORDER BY e.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.order_push_events e
    SET
      processing_started_at = now(),
      attempts = e.attempts + 1,
      last_error = NULL,
      failed_at = NULL
    FROM candidate c
    WHERE e.id = c.id
    RETURNING e.*
  )
  SELECT * FROM claimed;
END;
$$;