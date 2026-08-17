-- Binder slots can now hold either a catalog card OR a user-uploaded custom
-- photo ("classic upload" per user request) — card_id becomes optional and a
-- new image_url column stores the Storage object path for image slots.
--
-- The old PK (collection_id, card_id) can't survive card_id going nullable
-- (a PK column is implicitly NOT NULL), so it's replaced by a surrogate id.
-- The "no duplicate card within one binder" guarantee that PK used to give
-- moves to a partial unique index instead (image slots have no such
-- constraint — nothing meaningful to dedupe on).

ALTER TABLE public.user_collection_items DROP CONSTRAINT user_collection_items_pkey;
ALTER TABLE public.user_collection_items ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.user_collection_items ADD PRIMARY KEY (id);

ALTER TABLE public.user_collection_items ALTER COLUMN card_id DROP NOT NULL;
ALTER TABLE public.user_collection_items ADD COLUMN image_url text;

ALTER TABLE public.user_collection_items ADD CONSTRAINT user_collection_items_content_check
  CHECK ((card_id IS NOT NULL) <> (image_url IS NOT NULL));

CREATE UNIQUE INDEX user_collection_items_card_unique_idx
  ON public.user_collection_items (collection_id, card_id) WHERE card_id IS NOT NULL;

-- Private bucket, one folder per user (`{user_id}/...`) — RLS below scopes
-- every operation to the requesting user's own folder, same private-by-default
-- posture as the rest of the binder feature.
INSERT INTO storage.buckets (id, name, public)
VALUES ('binder-images', 'binder-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "binder_images_select_self" ON storage.objects
FOR SELECT USING (bucket_id = 'binder-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "binder_images_insert_self" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'binder-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "binder_images_delete_self" ON storage.objects
FOR DELETE USING (bucket_id = 'binder-images' AND (storage.foldername(name))[1] = auth.uid()::text);
