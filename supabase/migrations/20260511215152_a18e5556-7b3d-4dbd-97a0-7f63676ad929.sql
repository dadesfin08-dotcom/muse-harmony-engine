ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS vendor_type text NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS assigned_categories text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';