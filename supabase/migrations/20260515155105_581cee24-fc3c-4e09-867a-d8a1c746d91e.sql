-- 1) Core analytics tables (idempotent)
CREATE TABLE IF NOT EXISTS public.brand_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid,
  user_id uuid,
  event_type varchar(20) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_scores (
  brand_id uuid PRIMARY KEY,
  base_score numeric NOT NULL DEFAULT 0,
  trending_velocity numeric NOT NULL DEFAULT 0,
  active_until timestamp with time zone NOT NULL DEFAULT (now() + interval '3 days'),
  is_trending boolean NOT NULL DEFAULT false,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trending_history (
  id bigserial PRIMARY KEY,
  brand_id uuid,
  score numeric NOT NULL DEFAULT 0,
  recorded_at timestamp without time zone NOT NULL DEFAULT now()
);

-- 2) Bring existing schemas to expected defaults/constraints
ALTER TABLE public.brand_analytics_events
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.brand_scores
  ALTER COLUMN base_score SET DEFAULT 0,
  ALTER COLUMN base_score SET NOT NULL,
  ALTER COLUMN trending_velocity SET DEFAULT 0,
  ALTER COLUMN trending_velocity SET NOT NULL,
  ALTER COLUMN active_until SET DEFAULT (now() + interval '3 days'),
  ALTER COLUMN active_until SET NOT NULL,
  ALTER COLUMN is_trending SET DEFAULT false,
  ALTER COLUMN is_trending SET NOT NULL,
  ALTER COLUMN last_updated SET DEFAULT now(),
  ALTER COLUMN last_updated SET NOT NULL;

ALTER TABLE public.trending_history
  ALTER COLUMN score SET DEFAULT 0,
  ALTER COLUMN score SET NOT NULL,
  ALTER COLUMN recorded_at SET DEFAULT now(),
  ALTER COLUMN recorded_at SET NOT NULL;

ALTER TABLE public.brand_scores
  ADD COLUMN IF NOT EXISTS last_auto_renewed_at timestamp with time zone;

-- 3) Foreign keys to brands (safe idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brand_analytics_events_brand_id_fkey'
      AND conrelid = 'public.brand_analytics_events'::regclass
  ) THEN
    ALTER TABLE public.brand_analytics_events
      ADD CONSTRAINT brand_analytics_events_brand_id_fkey
      FOREIGN KEY (brand_id) REFERENCES public.brands(id)
      ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'brand_scores_brand_id_fkey'
      AND conrelid = 'public.brand_scores'::regclass
  ) THEN
    ALTER TABLE public.brand_scores
      ADD CONSTRAINT brand_scores_brand_id_fkey
      FOREIGN KEY (brand_id) REFERENCES public.brands(id)
      ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trending_history_brand_id_fkey'
      AND conrelid = 'public.trending_history'::regclass
  ) THEN
    ALTER TABLE public.trending_history
      ADD CONSTRAINT trending_history_brand_id_fkey
      FOREIGN KEY (brand_id) REFERENCES public.brands(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 4) Performance indexes for high-volume analytics
CREATE INDEX IF NOT EXISTS idx_brand_analytics_events_brand_time
  ON public.brand_analytics_events (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_analytics_events_type_time
  ON public.brand_analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_scores_trending_active_until
  ON public.brand_scores (is_trending, active_until);

CREATE INDEX IF NOT EXISTS idx_trending_history_brand_recorded
  ON public.trending_history (brand_id, recorded_at DESC);

-- 5) RLS hardening
ALTER TABLE public.brand_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_analytics_events'
      AND policyname = 'Admins can view brand analytics events'
  ) THEN
    CREATE POLICY "Admins can view brand analytics events"
      ON public.brand_analytics_events
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_analytics_events'
      AND policyname = 'Authenticated users can insert own brand analytics events'
  ) THEN
    CREATE POLICY "Authenticated users can insert own brand analytics events"
      ON public.brand_analytics_events
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id IS NULL OR user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'brand_scores'
      AND policyname = 'Admins can view brand scores'
  ) THEN
    CREATE POLICY "Admins can view brand scores"
      ON public.brand_scores
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trending_history'
      AND policyname = 'Admins can view trending history'
  ) THEN
    CREATE POLICY "Admins can view trending history"
      ON public.trending_history
      FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END$$;

-- 6) Utility function: weighted score formula
CREATE OR REPLACE FUNCTION public.compute_brand_score(
  p_orders integer,
  p_cart integer,
  p_search integer,
  p_views integer
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    (GREATEST(COALESCE(p_orders, 0), 0) * 10)
    + (GREATEST(COALESCE(p_cart, 0), 0) * 5)
    + (GREATEST(COALESCE(p_search, 0), 0) * 3)
    + (GREATEST(COALESCE(p_views, 0), 0) * 1)
$$;

-- 7) Utility function: event ingestion
CREATE OR REPLACE FUNCTION public.record_brand_event(
  p_brand_id uuid,
  p_user_id uuid,
  p_event_type varchar,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_event_type text;
BEGIN
  v_event_type := lower(trim(coalesce(p_event_type, '')));

  IF v_event_type NOT IN ('view', 'search', 'cart', 'order') THEN
    RAISE EXCEPTION 'Invalid event_type: %', p_event_type;
  END IF;

  INSERT INTO public.brand_analytics_events (brand_id, user_id, event_type, metadata)
  VALUES (p_brand_id, p_user_id, v_event_type, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 8) Core function: refresh scores + auto-renew + history snapshot
CREATE OR REPLACE FUNCTION public.refresh_brand_scores()
RETURNS TABLE (
  brand_id uuid,
  base_score numeric,
  trending_velocity numeric,
  is_trending boolean,
  active_until timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH events_24h AS (
    SELECT
      e.brand_id,
      COUNT(*) FILTER (WHERE e.event_type = 'order')::int AS orders_count,
      COUNT(*) FILTER (WHERE e.event_type = 'cart')::int AS cart_count,
      COUNT(*) FILTER (WHERE e.event_type = 'search')::int AS search_count,
      COUNT(*) FILTER (WHERE e.event_type = 'view')::int AS view_count
    FROM public.brand_analytics_events e
    WHERE e.created_at >= now() - interval '24 hours'
    GROUP BY e.brand_id
  ),
  orders_current AS (
    SELECT e.brand_id, COUNT(*)::numeric AS order_count
    FROM public.brand_analytics_events e
    WHERE e.event_type = 'order'
      AND e.created_at >= now() - interval '24 hours'
    GROUP BY e.brand_id
  ),
  orders_previous AS (
    SELECT e.brand_id, COUNT(*)::numeric AS order_count
    FROM public.brand_analytics_events e
    WHERE e.event_type = 'order'
      AND e.created_at >= now() - interval '48 hours'
      AND e.created_at < now() - interval '24 hours'
    GROUP BY e.brand_id
  ),
  computed AS (
    SELECT
      b.id AS brand_id,
      public.compute_brand_score(
        COALESCE(ev.orders_count, 0),
        COALESCE(ev.cart_count, 0),
        COALESCE(ev.search_count, 0),
        COALESCE(ev.view_count, 0)
      ) AS computed_score,
      (
        (COALESCE(oc.order_count, 0) - COALESCE(op.order_count, 0))
        / GREATEST(COALESCE(op.order_count, 0), 1)
      ) * 100 AS velocity_pct,
      (
        (COALESCE(oc.order_count, 0) - COALESCE(op.order_count, 0))
        / GREATEST(COALESCE(op.order_count, 0), 1)
      ) AS velocity_ratio,
      bs.active_until AS prev_active_until,
      bs.last_auto_renewed_at
    FROM public.brands b
    LEFT JOIN events_24h ev ON ev.brand_id = b.id
    LEFT JOIN orders_current oc ON oc.brand_id = b.id
    LEFT JOIN orders_previous op ON op.brand_id = b.id
    LEFT JOIN public.brand_scores bs ON bs.brand_id = b.id
  ),
  upserted AS (
    INSERT INTO public.brand_scores (
      brand_id,
      base_score,
      trending_velocity,
      active_until,
      is_trending,
      last_updated,
      last_auto_renewed_at
    )
    SELECT
      c.brand_id,
      c.computed_score,
      c.velocity_pct,
      CASE
        WHEN c.velocity_ratio > 0.20
             AND (
               c.last_auto_renewed_at IS NULL
               OR c.last_auto_renewed_at <= now() - interval '24 hours'
             )
          THEN GREATEST(COALESCE(c.prev_active_until, now()), now()) + interval '72 hours'
        ELSE COALESCE(c.prev_active_until, now() + interval '72 hours')
      END AS next_active_until,
      (c.computed_score > 120) AS is_trending,
      now(),
      CASE
        WHEN c.velocity_ratio > 0.20
             AND (
               c.last_auto_renewed_at IS NULL
               OR c.last_auto_renewed_at <= now() - interval '24 hours'
             )
          THEN now()
        ELSE c.last_auto_renewed_at
      END AS next_last_auto_renewed_at
    FROM computed c
    ON CONFLICT (brand_id)
    DO UPDATE SET
      base_score = EXCLUDED.base_score,
      trending_velocity = EXCLUDED.trending_velocity,
      active_until = EXCLUDED.active_until,
      is_trending = EXCLUDED.is_trending,
      last_updated = now(),
      last_auto_renewed_at = EXCLUDED.last_auto_renewed_at
    RETURNING
      brand_scores.brand_id,
      brand_scores.base_score,
      brand_scores.trending_velocity,
      brand_scores.is_trending,
      brand_scores.active_until
  )
  INSERT INTO public.trending_history (brand_id, score, recorded_at)
  SELECT u.brand_id, u.base_score, now()
  FROM upserted u;

  RETURN QUERY
  SELECT
    bs.brand_id,
    bs.base_score,
    bs.trending_velocity,
    bs.is_trending,
    bs.active_until
  FROM public.brand_scores bs
  ORDER BY bs.base_score DESC;
END;
$$;

-- 9) Restrict function execution surface
REVOKE ALL ON FUNCTION public.record_brand_event(uuid, uuid, varchar, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_brand_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_brand_score(integer, integer, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_brand_event(uuid, uuid, varchar, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_brand_scores() TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_brand_score(integer, integer, integer, integer) TO authenticated, service_role;