ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Groceries';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Vegetables & Fruits';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Meat & Poultry';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Bakery & Pastry';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Dairy & Eggs';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Drinks & Water';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Cleaning Supplies';

ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Gram';
ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Bunch';
ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Tray';
ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Box';