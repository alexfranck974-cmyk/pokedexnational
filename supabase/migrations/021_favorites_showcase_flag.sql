-- "Vitrine": users curate a subset of their favorited cards to feature in the
-- showcase carousel shown on the dashboard and public profile (see 020 for
-- why user_favorites is now publicly readable).
ALTER TABLE public.user_favorites ADD COLUMN in_showcase boolean NOT NULL DEFAULT false;

-- No UPDATE policy existed yet on this table (insert/delete only) — needed so
-- users can flip in_showcase on their own rows.
CREATE POLICY "user_favorites_update_self" ON public.user_favorites
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
