ALTER TABLE public.tcg_cards ADD COLUMN artist text;
CREATE INDEX tcg_cards_artist_idx ON public.tcg_cards (artist);
