-- Which finishes (normal/holo/reverse_holo) a print actually exists in, derived
-- from pokemontcg.io's tcgplayer.prices object (its keys — "normal",
-- "holofoil", "reverseHolofoil", "1stEditionHolofoil", "1stEditionNormal" —
-- indicate which finishes TCGplayer lists for that card). NULL means not yet
-- synced (or no tcgplayer data available for that print, e.g. most JP/CN
-- cards) — client code should treat NULL/empty the same as "unknown", not
-- "no finishes exist".
ALTER TABLE public.tcg_cards ADD COLUMN available_finishes text[];
