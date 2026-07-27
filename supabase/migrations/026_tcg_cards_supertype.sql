-- dex_num becomes optional: Trainer/Energy cards have no National Pokédex number.
ALTER TABLE public.tcg_cards ALTER COLUMN dex_num DROP NOT NULL;
ALTER TABLE public.tcg_cards DROP CONSTRAINT tcg_cards_dex_num_check;
ALTER TABLE public.tcg_cards ADD CONSTRAINT tcg_cards_dex_num_check
  CHECK (dex_num IS NULL OR dex_num BETWEEN 1 AND 1025);

-- Card category, exact pokemontcg.io API values: "Pokémon" | "Trainer" | "Energy".
-- DEFAULT 'Pokémon' correctly backfills every row already in the table.
ALTER TABLE public.tcg_cards ADD COLUMN supertype text NOT NULL DEFAULT 'Pokémon';
ALTER TABLE public.tcg_cards ADD COLUMN subtypes text[];
CREATE INDEX tcg_cards_supertype_idx ON public.tcg_cards (supertype);
