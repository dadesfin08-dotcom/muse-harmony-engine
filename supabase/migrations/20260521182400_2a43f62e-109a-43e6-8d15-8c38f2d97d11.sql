DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'category_visual_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.category_visual_type AS ENUM ('icon', 'image');
  END IF;
END
$$;

ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS visual_type public.category_visual_type;

UPDATE public.categories
SET visual_type = CASE
  WHEN COALESCE(NULLIF(TRIM(image_url), ''), '') <> '' THEN 'image'::public.category_visual_type
  ELSE 'icon'::public.category_visual_type
END
WHERE visual_type IS NULL;

ALTER TABLE public.categories
ALTER COLUMN visual_type SET DEFAULT 'icon'::public.category_visual_type,
ALTER COLUMN visual_type SET NOT NULL;