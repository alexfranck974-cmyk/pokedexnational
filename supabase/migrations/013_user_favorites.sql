CREATE TABLE public.user_favorites (
  user_id       uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dex_num       int2         NOT NULL CHECK (dex_num BETWEEN 1 AND 1025),
  favorited_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dex_num)
);

CREATE INDEX user_favorites_user_id_idx ON public.user_favorites (user_id);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Private only — no public sharing for favorites
CREATE POLICY "user_favorites_select_self" ON public.user_favorites
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_favorites_insert_self" ON public.user_favorites
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_favorites_delete_self" ON public.user_favorites
FOR DELETE USING (auth.uid() = user_id);
