ALTER TABLE public.pack_items
ADD COLUMN IF NOT EXISTS item_data jsonb;

UPDATE public.pack_items
SET item_data = jsonb_build_object('name', item_label)
WHERE item_data IS NULL
  AND coalesce(item_label, '') <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pack_items_item_data_object_chk'
      AND conrelid = 'public.pack_items'::regclass
  ) THEN
    ALTER TABLE public.pack_items
    ADD CONSTRAINT pack_items_item_data_object_chk
    CHECK (item_data IS NULL OR jsonb_typeof(item_data) = 'object');
  END IF;
END $$;