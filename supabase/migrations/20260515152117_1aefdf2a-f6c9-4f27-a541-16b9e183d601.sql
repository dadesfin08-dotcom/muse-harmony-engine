ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS messages_en text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS messages_fr text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS messages_ar text[] NOT NULL DEFAULT '{}';

UPDATE public.announcements
SET
  title = COALESCE(NULLIF(title, ''), 'Announcement ' || substr(id::text, 1, 8)),
  messages_en = CASE
    WHEN array_length(messages_en, 1) IS NOT NULL THEN messages_en
    WHEN message_en IS NOT NULL AND btrim(message_en) <> '' THEN ARRAY[message_en]
    WHEN content IS NOT NULL AND btrim(content) <> '' THEN ARRAY[content]
    ELSE '{}'
  END,
  messages_fr = CASE
    WHEN array_length(messages_fr, 1) IS NOT NULL THEN messages_fr
    WHEN message_fr IS NOT NULL AND btrim(message_fr) <> '' THEN ARRAY[message_fr]
    WHEN content_fr IS NOT NULL AND btrim(content_fr) <> '' THEN ARRAY[content_fr]
    ELSE '{}'
  END,
  messages_ar = CASE
    WHEN array_length(messages_ar, 1) IS NOT NULL THEN messages_ar
    WHEN message_ar IS NOT NULL AND btrim(message_ar) <> '' THEN ARRAY[message_ar]
    WHEN content_ar IS NOT NULL AND btrim(content_ar) <> '' THEN ARRAY[content_ar]
    ELSE '{}'
  END;

ALTER TABLE public.announcements
ALTER COLUMN title SET NOT NULL;