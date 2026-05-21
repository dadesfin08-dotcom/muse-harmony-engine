ALTER TABLE public.master_products
ADD COLUMN IF NOT EXISTS category_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.master_products
SET category_ids = ARRAY[category_id]
WHERE category_id IS NOT NULL
  AND (category_ids IS NULL OR cardinality(category_ids) = 0);

ALTER TABLE public.master_products
ADD CONSTRAINT master_products_category_ids_max4
CHECK (cardinality(category_ids) <= 4);

CREATE INDEX IF NOT EXISTS idx_master_products_category_ids_gin
ON public.master_products USING GIN (category_ids);