ALTER TABLE public.tcg_cards ADD COLUMN region text NOT NULL DEFAULT 'global';
ALTER TABLE public.tcg_cards ADD CONSTRAINT tcg_cards_region_check CHECK (region IN ('global', 'jp', 'cn'));
CREATE INDEX tcg_cards_region_idx ON public.tcg_cards (region);
