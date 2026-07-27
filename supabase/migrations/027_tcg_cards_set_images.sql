ALTER TABLE public.tcg_cards ADD COLUMN set_symbol text;
ALTER TABLE public.tcg_cards ADD COLUMN set_logo text;

-- New columns must be appended after the existing ones (card_count) — CREATE OR
-- REPLACE VIEW only allows adding columns at the end, not inserting/reordering.
CREATE OR REPLACE VIEW public.tcg_sets WITH (security_invoker = on) AS
SELECT DISTINCT ON (set_id)
  set_id,
  set_name,
  release_date,
  count(*) OVER (PARTITION BY set_id) AS card_count,
  set_symbol,
  set_logo
FROM public.tcg_cards
ORDER BY set_id, release_date DESC NULLS LAST;
