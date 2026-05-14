ALTER TABLE public.invoice_settings
ADD COLUMN IF NOT EXISTS receipt_logo_url text,
ADD COLUMN IF NOT EXISTS receipt_store_name text,
ADD COLUMN IF NOT EXISTS receipt_slogan text,
ADD COLUMN IF NOT EXISTS receipt_phone text,
ADD COLUMN IF NOT EXISTS receipt_address text,
ADD COLUMN IF NOT EXISTS receipt_website text,
ADD COLUMN IF NOT EXISTS receipt_footer_message text,
ADD COLUMN IF NOT EXISTS receipt_social_support text;