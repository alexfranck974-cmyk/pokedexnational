ALTER TABLE public.user_owned_cards ADD COLUMN quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 1);

CREATE POLICY "user_owned_cards_update_self" ON public.user_owned_cards
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
