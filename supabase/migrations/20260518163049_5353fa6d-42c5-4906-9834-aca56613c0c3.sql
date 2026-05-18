ALTER TABLE public.hero_sections
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge_fr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_fr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle_fr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_timing_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_timing_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_timing_fr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_text_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_text_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_text_fr text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_link text,
  ADD COLUMN IF NOT EXISTS accent_from text,
  ADD COLUMN IF NOT EXISTS accent_to text,
  ADD COLUMN IF NOT EXISTS accent_chip_bg text,
  ADD COLUMN IF NOT EXISTS accent_chip_text text;

UPDATE public.hero_sections
SET
  title_ar = CASE WHEN coalesce(title_ar, '') = '' THEN coalesce(headline_ar, '') ELSE title_ar END,
  title_en = CASE WHEN coalesce(title_en, '') = '' THEN coalesce(headline_en, '') ELSE title_en END,
  title_fr = CASE WHEN coalesce(title_fr, '') = '' THEN coalesce(headline_fr, '') ELSE title_fr END,
  subtitle_ar = CASE WHEN coalesce(subtitle_ar, '') = '' THEN coalesce(description_ar, '') ELSE subtitle_ar END,
  subtitle_en = CASE WHEN coalesce(subtitle_en, '') = '' THEN coalesce(description_en, '') ELSE subtitle_en END,
  subtitle_fr = CASE WHEN coalesce(subtitle_fr, '') = '' THEN coalesce(description_fr, '') ELSE subtitle_fr END,
  badge_ar = CASE WHEN coalesce(badge_ar, '') = '' THEN 'توصيل سريع بالدراجة' ELSE badge_ar END,
  badge_en = CASE WHEN coalesce(badge_en, '') = '' THEN 'Bicycle delivery across Morocco' ELSE badge_en END,
  badge_fr = CASE WHEN coalesce(badge_fr, '') = '' THEN 'Livraison à vélo au Maroc' ELSE badge_fr END,
  delivery_timing_ar = CASE WHEN coalesce(delivery_timing_ar, '') = '' THEN 'متوسط التوصيل: 15 دقيقة' ELSE delivery_timing_ar END,
  delivery_timing_en = CASE WHEN coalesce(delivery_timing_en, '') = '' THEN 'Avg. delivery: 15 min' ELSE delivery_timing_en END,
  delivery_timing_fr = CASE WHEN coalesce(delivery_timing_fr, '') = '' THEN 'Livraison moyenne : 15 min' ELSE delivery_timing_fr END,
  cta_text_ar = CASE WHEN coalesce(cta_text_ar, '') = '' THEN 'ابدأ التسوق' ELSE cta_text_ar END,
  cta_text_en = CASE WHEN coalesce(cta_text_en, '') = '' THEN 'Start shopping' ELSE cta_text_en END,
  cta_text_fr = CASE WHEN coalesce(cta_text_fr, '') = '' THEN 'Commencer les achats' ELSE cta_text_fr END,
  sort_order = coalesce(sort_order, 0);

ALTER TABLE public.hero_sections
  ADD CONSTRAINT hero_sections_sort_order_non_negative CHECK (sort_order >= 0);

ALTER TABLE public.hero_sections
  ADD CONSTRAINT hero_sections_cta_link_length CHECK (cta_link IS NULL OR char_length(cta_link) <= 2000);

CREATE INDEX IF NOT EXISTS hero_sections_sort_order_idx
  ON public.hero_sections (sort_order ASC, updated_at DESC);

CREATE INDEX IF NOT EXISTS hero_sections_active_sort_idx
  ON public.hero_sections (is_active, sort_order ASC, updated_at DESC);