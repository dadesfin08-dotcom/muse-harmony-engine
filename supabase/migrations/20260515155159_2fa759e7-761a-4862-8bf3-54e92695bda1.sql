ALTER TABLE public.brand_scores
  ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_boost_until timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_brand_scores_blacklist_trending
  ON public.brand_scores (is_blacklisted, is_trending, active_until);