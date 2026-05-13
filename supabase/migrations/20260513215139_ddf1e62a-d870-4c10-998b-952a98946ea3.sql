ALTER TABLE public.neighborhoods
ADD COLUMN IF NOT EXISTS zone_code TEXT;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.neighborhoods
)
UPDATE public.neighborhoods n
SET zone_code = CONCAT('SZ-', LPAD(ordered.rn::text, 6, '0'))
FROM ordered
WHERE n.id = ordered.id
  AND (n.zone_code IS NULL OR btrim(n.zone_code) = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'neighborhoods_zone_code_key'
      AND conrelid = 'public.neighborhoods'::regclass
  ) THEN
    ALTER TABLE public.neighborhoods
    ADD CONSTRAINT neighborhoods_zone_code_key UNIQUE (zone_code);
  END IF;
END $$;

ALTER TABLE public.neighborhoods
ALTER COLUMN zone_code SET NOT NULL;