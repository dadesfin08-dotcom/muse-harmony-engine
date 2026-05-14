ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS site_name TEXT NOT NULL DEFAULT 'Bzaf Fresh',
ADD COLUMN IF NOT EXISTS site_logo_url TEXT;

UPDATE public.global_settings
SET site_name = 'Bzaf Fresh'
WHERE site_name IS NULL OR btrim(site_name) = '';

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view public-assets objects'
  ) THEN
    CREATE POLICY "Public can view public-assets objects"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'public-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can upload public-assets objects'
  ) THEN
    CREATE POLICY "Authenticated can upload public-assets objects"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'public-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can update public-assets objects'
  ) THEN
    CREATE POLICY "Authenticated can update public-assets objects"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'public-assets')
      WITH CHECK (bucket_id = 'public-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can delete public-assets objects'
  ) THEN
    CREATE POLICY "Authenticated can delete public-assets objects"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'public-assets');
  END IF;
END $$;