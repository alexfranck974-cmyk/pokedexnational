CREATE TABLE public.user_cards (
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id      text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  acquired_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX user_cards_user_id_idx ON public.user_cards (user_id);
