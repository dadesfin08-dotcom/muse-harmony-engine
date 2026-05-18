CREATE TABLE public.hero_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  greeting_ar TEXT NOT NULL DEFAULT '',
  greeting_en TEXT NOT NULL DEFAULT '',
  greeting_fr TEXT NOT NULL DEFAULT '',
  headline_ar TEXT NOT NULL DEFAULT '',
  headline_en TEXT NOT NULL DEFAULT '',
  headline_fr TEXT NOT NULL DEFAULT '',
  description_ar TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  description_fr TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active hero sections"
ON public.hero_sections
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all hero sections"
ON public.hero_sections
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert hero sections"
ON public.hero_sections
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update hero sections"
ON public.hero_sections
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete hero sections"
ON public.hero_sections
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_hero_sections_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_hero_sections_updated_at
BEFORE UPDATE ON public.hero_sections
FOR EACH ROW
EXECUTE FUNCTION public.set_hero_sections_updated_at();

CREATE UNIQUE INDEX hero_sections_single_active_idx
ON public.hero_sections ((is_active))
WHERE is_active = true;

INSERT INTO public.hero_sections (
  greeting_ar,
  greeting_en,
  greeting_fr,
  headline_ar,
  headline_en,
  headline_fr,
  description_ar,
  description_en,
  description_fr,
  is_active
)
SELECT
  'صباح الخير 👋',
  'Good morning, 👋',
  'Bonjour, 👋',
  'خضروات طازجة تصلك في 15 دقيقة',
  'Fresh groceries, delivered in 15 min',
  'Produits frais livrés en 15 min',
  'منتجات محلية، توصيل سريع، ومتاجر موثوقة بالقرب منك.',
  'Local produce, fast riders, and trusted vendors near you.',
  'Produits locaux, livraison rapide et vendeurs de confiance près de chez vous.',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.hero_sections);