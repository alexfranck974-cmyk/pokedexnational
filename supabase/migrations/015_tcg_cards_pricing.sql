ALTER TABLE public.tcg_cards ADD COLUMN cardmarket_trend_eur numeric(10,2);
ALTER TABLE public.tcg_cards ADD COLUMN cardmarket_avg_eur numeric(10,2);
ALTER TABLE public.tcg_cards ADD COLUMN cardmarket_low_eur numeric(10,2);
ALTER TABLE public.tcg_cards ADD COLUMN cardmarket_updated_at timestamptz;

CREATE INDEX tcg_cards_cardmarket_trend_idx ON public.tcg_cards (cardmarket_trend_eur);
