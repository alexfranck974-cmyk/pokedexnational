ALTER TABLE public.tcg_cards ADD COLUMN series text;
CREATE INDEX tcg_cards_series_idx ON public.tcg_cards (series);
