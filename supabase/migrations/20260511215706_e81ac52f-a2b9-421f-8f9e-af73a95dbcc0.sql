INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view products bucket objects'
  ) THEN
    CREATE POLICY "Public can view products bucket objects"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'products');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can upload products bucket objects'
  ) THEN
    CREATE POLICY "Authenticated can upload products bucket objects"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'products');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can update products bucket objects'
  ) THEN
    CREATE POLICY "Authenticated can update products bucket objects"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'products')
      WITH CHECK (bucket_id = 'products');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated can delete products bucket objects'
  ) THEN
    CREATE POLICY "Authenticated can delete products bucket objects"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'products');
  END IF;
END $$;