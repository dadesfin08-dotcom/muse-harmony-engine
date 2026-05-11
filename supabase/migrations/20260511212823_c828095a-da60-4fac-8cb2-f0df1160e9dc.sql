CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'app_role' AND n.nspname = 'public') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'product_category' AND n.nspname = 'public') THEN
    CREATE TYPE public.product_category AS ENUM ('Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Pantry');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'measurement_unit' AND n.nspname = 'public') THEN
    CREATE TYPE public.measurement_unit AS ENUM ('Kg', 'Liter', 'Piece', 'Pack');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'order_status' AND n.nspname = 'public') THEN
    CREATE TYPE public.order_status AS ENUM ('new', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'payment_method' AND n.nspname = 'public') THEN
    CREATE TYPE public.payment_method AS ENUM ('COD', 'Carnet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'vendor_settlement_status' AND n.nspname = 'public') THEN
    CREATE TYPE public.vendor_settlement_status AS ENUM ('pending', 'settled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  preferred_language text NOT NULL DEFAULT 'en',
  full_name text,
  phone text,
  address text,
  neighborhood_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  name text NOT NULL,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  vendor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commune_id, name)
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  store_name text NOT NULL,
  owner_name text,
  phone_number text NOT NULL UNIQUE,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.neighborhoods
  DROP CONSTRAINT IF EXISTS neighborhoods_vendor_id_fkey;

ALTER TABLE public.neighborhoods
  ADD CONSTRAINT neighborhoods_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_neighborhood_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_neighborhood_id_fkey
  FOREIGN KEY (neighborhood_id) REFERENCES public.neighborhoods(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.cyclists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cyclist_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cyclist_id uuid NOT NULL REFERENCES public.cyclists(id) ON DELETE CASCADE,
  neighborhood_id uuid NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cyclist_id, neighborhood_id)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_fr text,
  name_ar text,
  icon_name text,
  image_url text,
  accent_color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL UNIQUE,
  name_fr text,
  name_ar text,
  category public.product_category NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  measurement_unit public.measurement_unit NOT NULL,
  image_url text,
  popularity_score integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  master_product_id uuid NOT NULL REFERENCES public.master_products(id) ON DELETE CASCADE,
  vendor_price numeric(12,2) NOT NULL DEFAULT 0,
  name_fr text,
  name_ar text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url text,
  measurement_unit public.measurement_unit,
  popularity_score integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_flash_sale boolean NOT NULL DEFAULT false,
  flash_sale_price numeric(12,2),
  flash_sale_end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, master_product_id)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number text UNIQUE,
  full_name text,
  saved_instructions text,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  cyclist_id uuid REFERENCES public.cyclists(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  delivery_notes text NOT NULL DEFAULT '',
  payment_method public.payment_method NOT NULL DEFAULT 'COD',
  status public.order_status NOT NULL DEFAULT 'new',
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  order_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_auth_code varchar(6) NOT NULL DEFAULT LPAD((FLOOR(RANDOM() * 1000000)::int)::text, 6, '0'),
  vendor_settlement_status public.vendor_settlement_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.site_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  content_fr text,
  content_ar text,
  image_url text,
  link_url text,
  bg_color text,
  text_color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  content_fr text,
  content_ar text,
  image_url text,
  link_url text,
  bg_color text,
  text_color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text,
  address text,
  phone text,
  tax_id text,
  footer_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_carnet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text,
  customer_cin text,
  current_debt numeric(12,2) NOT NULL DEFAULT 0,
  max_limit numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, customer_phone)
);

CREATE TABLE IF NOT EXISTS public.carnet_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_carnet_id uuid NOT NULL REFERENCES public.vendor_carnet(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_delivery_fee numeric NOT NULL DEFAULT 10,
  minimum_order_amount numeric NOT NULL DEFAULT 50,
  free_delivery_threshold numeric NOT NULL DEFAULT 500,
  marketplace_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_service_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  neighborhood_id uuid NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, neighborhood_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cyclists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cyclist_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_carnet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carnet_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_service_zones ENABLE ROW LEVEL SECURITY;