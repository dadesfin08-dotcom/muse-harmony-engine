DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'campaign_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.campaign_type AS ENUM ('AD', 'PROMO', 'NEWS');
  END IF;
END
$$;

ALTER TABLE public.site_ads
  ADD COLUMN IF NOT EXISTS zone_id uuid,
  ADD COLUMN IF NOT EXISTS campaign_type public.campaign_type NOT NULL DEFAULT 'AD',
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_ads_zone_id_fkey'
      AND conrelid = 'public.site_ads'::regclass
  ) THEN
    ALTER TABLE public.site_ads
      ADD CONSTRAINT site_ads_zone_id_fkey
      FOREIGN KEY (zone_id)
      REFERENCES public.neighborhoods(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_site_ads_zone_id ON public.site_ads(zone_id);
CREATE INDEX IF NOT EXISTS idx_site_ads_campaign_type ON public.site_ads(campaign_type);

CREATE OR REPLACE FUNCTION public.increment_campaign_view(campaign_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.site_ads
  SET views_count = COALESCE(views_count, 0) + 1,
      updated_at = now()
  WHERE id = campaign_id_input;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_view(uuid) TO anon, authenticated;