-- Add new multi-zone targeting column
ALTER TABLE public.site_ads
ADD COLUMN IF NOT EXISTS target_zone_ids uuid[];

-- Backfill from legacy single-zone field
UPDATE public.site_ads
SET target_zone_ids = CASE
  WHEN zone_id IS NULL THEN NULL
  ELSE ARRAY[zone_id]
END
WHERE target_zone_ids IS NULL;

-- Optional index for overlap/contains filters
CREATE INDEX IF NOT EXISTS idx_site_ads_target_zone_ids
ON public.site_ads USING GIN (target_zone_ids);

-- Remove legacy single-zone field after backfill
ALTER TABLE public.site_ads
DROP COLUMN IF EXISTS zone_id;