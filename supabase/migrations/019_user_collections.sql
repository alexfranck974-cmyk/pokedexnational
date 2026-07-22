CREATE TABLE public.user_collections (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX user_collections_user_id_idx ON public.user_collections (user_id);

CREATE TABLE public.user_collection_items (
  collection_id  uuid         NOT NULL REFERENCES public.user_collections(id) ON DELETE CASCADE,
  card_id        text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  added_at       timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, card_id)
);

ALTER TABLE public.user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection_items ENABLE ROW LEVEL SECURITY;

-- Private only — no public sharing for collections
CREATE POLICY "user_collections_select_self" ON public.user_collections
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_collections_insert_self" ON public.user_collections
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_collections_update_self" ON public.user_collections
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_collections_delete_self" ON public.user_collections
FOR DELETE USING (auth.uid() = user_id);

-- user_collection_items has no user_id column, so policies gate through the parent collection.
CREATE POLICY "user_collection_items_select_self" ON public.user_collection_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
);

CREATE POLICY "user_collection_items_insert_self" ON public.user_collection_items
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
);

CREATE POLICY "user_collection_items_delete_self" ON public.user_collection_items
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
);
