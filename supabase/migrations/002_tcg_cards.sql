CREATE TABLE public.tcg_cards (
  id            text          PRIMARY KEY,
  name          text          NOT NULL,
  dex_num       int2          NOT NULL CHECK (dex_num BETWEEN 1 AND 1025),
  set_id        text          NOT NULL,
  set_name      text          NOT NULL,
  card_number   text          NOT NULL,
  rarity        text,
  image_small   text          NOT NULL,
  image_large   text,
  release_date  date,
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX tcg_cards_dex_num_idx  ON public.tcg_cards (dex_num);
CREATE INDEX tcg_cards_set_id_idx   ON public.tcg_cards (set_id);
CREATE INDEX tcg_cards_rarity_idx   ON public.tcg_cards (rarity);
