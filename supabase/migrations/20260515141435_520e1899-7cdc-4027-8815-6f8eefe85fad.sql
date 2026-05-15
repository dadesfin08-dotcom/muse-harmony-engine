ALTER TABLE public.site_ads
  ADD COLUMN IF NOT EXISTS campaign_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_ar text,
  ADD COLUMN IF NOT EXISTS image_fr text,
  ADD COLUMN IF NOT EXISTS image_en text,
  ADD COLUMN IF NOT EXISTS target_url text,
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS end_date timestamptz;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS message_ar text,
  ADD COLUMN IF NOT EXISTS message_fr text,
  ADD COLUMN IF NOT EXISTS message_en text,
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS end_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_site_ads_active_schedule
  ON public.site_ads (is_active, start_date, end_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_active_schedule
  ON public.announcements (is_active, start_date, end_date, created_at DESC);