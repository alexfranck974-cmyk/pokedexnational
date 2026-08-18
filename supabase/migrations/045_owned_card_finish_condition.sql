-- Track finish (normal/holo/reverse_holo) and condition per physical copy.
-- Widening the PK to (user_id, card_id, finish) lets a user own e.g. a normal
-- AND a reverse holo of the same card as two distinct, separately-tracked rows.
ALTER TABLE public.user_owned_cards
  ADD COLUMN finish text NOT NULL DEFAULT 'normal'
    CHECK (finish IN ('normal', 'holo', 'reverse_holo')),
  ADD COLUMN condition text
    CHECK (condition IN ('mint', 'near_mint', 'excellent', 'good', 'played', 'poor'));

ALTER TABLE public.user_owned_cards DROP CONSTRAINT user_owned_cards_pkey;
ALTER TABLE public.user_owned_cards ADD PRIMARY KEY (user_id, card_id, finish);
