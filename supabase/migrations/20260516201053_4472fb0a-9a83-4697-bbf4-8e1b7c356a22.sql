ALTER TABLE public.pack_features
ADD COLUMN IF NOT EXISTS feature_data jsonb;

UPDATE public.pack_features
SET feature_data = jsonb_build_object(
  'text_en', NULLIF(trim(feature_label), ''),
  'text_fr', NULL,
  'text_ar', NULL
)
WHERE feature_data IS NULL;