ALTER TABLE public.communes
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_fr text,
  ADD COLUMN IF NOT EXISTS name_ar text;

UPDATE public.communes
SET name_en = COALESCE(NULLIF(TRIM(name_en), ''), name)
WHERE name_en IS NULL OR TRIM(name_en) = '';

ALTER TABLE public.communes
  ALTER COLUMN name_en SET NOT NULL;

ALTER TABLE public.communes
  DROP COLUMN IF EXISTS name;