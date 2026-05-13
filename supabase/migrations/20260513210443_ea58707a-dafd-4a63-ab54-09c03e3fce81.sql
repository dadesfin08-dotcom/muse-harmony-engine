ALTER TABLE public.neighborhoods
  ADD COLUMN name_en text,
  ADD COLUMN name_fr text,
  ADD COLUMN name_ar text;

UPDATE public.neighborhoods
SET
  name_en = COALESCE(NULLIF(btrim(name), ''), 'Unnamed neighborhood'),
  name_fr = NULL,
  name_ar = NULL;

ALTER TABLE public.neighborhoods
  ALTER COLUMN name_en SET NOT NULL;

ALTER TABLE public.neighborhoods
  DROP COLUMN name;