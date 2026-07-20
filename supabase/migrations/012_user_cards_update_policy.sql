-- Required for the ON CONFLICT DO UPDATE path of useToggleCard's upsert.
-- Without this, RLS blocks the update silently and the mutation fails.
CREATE POLICY "user_cards_update_self" ON public.user_cards
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
