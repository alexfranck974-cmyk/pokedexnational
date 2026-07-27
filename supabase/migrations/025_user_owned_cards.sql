CREATE TABLE public.user_owned_cards (
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id      text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  acquired_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX user_owned_cards_user_id_idx ON public.user_owned_cards (user_id);

ALTER TABLE public.user_owned_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owned_cards_select_self" ON public.user_owned_cards
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_owned_cards_insert_self" ON public.user_owned_cards
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_owned_cards_delete_self" ON public.user_owned_cards
FOR DELETE USING (auth.uid() = user_id);

-- Backfill: any card already chosen as the official National Dex card is obviously
-- already owned — seed the ledger so existing progress doesn't regress to zero.
INSERT INTO public.user_owned_cards (user_id, card_id, acquired_at)
SELECT user_id, card_id, acquired_at FROM public.user_cards
ON CONFLICT (user_id, card_id) DO NOTHING;
