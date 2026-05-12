ALTER TABLE public.master_products
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS measurement_value numeric;

CREATE INDEX IF NOT EXISTS idx_master_products_brand
ON public.master_products (brand);