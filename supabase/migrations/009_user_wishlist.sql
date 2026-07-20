CREATE TABLE public.user_wishlist (
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id      text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  wished_at    timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX user_wishlist_user_id_idx ON public.user_wishlist (user_id);

ALTER TABLE public.user_wishlist ENABLE ROW LEVEL SECURITY;

-- Private only — no public sharing for wishlist
CREATE POLICY "user_wishlist_select_self" ON public.user_wishlist
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_wishlist_insert_self" ON public.user_wishlist
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_wishlist_delete_self" ON public.user_wishlist
FOR DELETE USING (auth.uid() = user_id);
