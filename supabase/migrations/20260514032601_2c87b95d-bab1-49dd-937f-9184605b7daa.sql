ALTER TABLE public.master_products
ADD COLUMN IF NOT EXISTS product_variants TEXT[] NOT NULL DEFAULT '{}'::text[];