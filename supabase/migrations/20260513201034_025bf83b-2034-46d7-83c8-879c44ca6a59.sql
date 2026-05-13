ALTER TABLE public.master_products
ADD COLUMN IF NOT EXISTS barcode text;

CREATE UNIQUE INDEX IF NOT EXISTS master_products_barcode_unique_idx
ON public.master_products (lower(btrim(barcode)))
WHERE barcode IS NOT NULL AND btrim(barcode) <> '';
