-- 041 added `position` + a unique (collection_id, position) index so a binder
-- slot can be "replaced" via upsert (INSERT ... ON CONFLICT (collection_id,
-- position) DO UPDATE). That DO UPDATE path needs an UPDATE policy, which
-- 019 never created (collection items used to be insert/delete-only, no
-- in-place replace). Without this, replacing an already-filled slot 403s.
CREATE POLICY "user_collection_items_update_self" ON public.user_collection_items
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
);
