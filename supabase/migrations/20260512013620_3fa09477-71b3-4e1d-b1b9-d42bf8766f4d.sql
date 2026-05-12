CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  name_fr TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX brands_name_en_unique_idx ON public.brands (lower(name_en));

INSERT INTO public.brands (name_en, name_ar, name_fr)
SELECT DISTINCT trim(mp.brand) AS name_en, trim(mp.brand) AS name_ar, trim(mp.brand) AS name_fr
FROM public.master_products mp
WHERE mp.brand IS NOT NULL
  AND trim(mp.brand) <> ''
ON CONFLICT ((lower(name_en))) DO NOTHING;

ALTER TABLE public.master_products
ADD COLUMN brand_id UUID;

UPDATE public.master_products mp
SET brand_id = b.id
FROM public.brands b
WHERE mp.brand IS NOT NULL
  AND trim(mp.brand) <> ''
  AND lower(trim(mp.brand)) = lower(trim(b.name_en));

ALTER TABLE public.master_products
ADD CONSTRAINT master_products_brand_id_fkey
FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX master_products_brand_id_idx ON public.master_products (brand_id);

ALTER TABLE public.master_products
DROP COLUMN brand;