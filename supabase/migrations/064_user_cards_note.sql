-- Free-text personal note per owned card slot (e.g. "cadeau de ..."). Lives on
-- the user_cards row (PK user_id, dex_num — see 010_single_owned_card_per_dex.sql)
-- since a note is about "the card I own for this Pokémon", same scope as
-- acquired_at right next to it. No RLS change needed — user_cards' existing
-- policies (005_rls.sql) already gate by owning user_id for every column.
ALTER TABLE public.user_cards ADD COLUMN note text;
