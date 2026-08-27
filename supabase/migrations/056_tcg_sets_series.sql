-- Exposes series on the tcg_sets view — lets the Extensions catalog group
-- global sets by era (Mega Evolution, Scarlet & Violet, Sword & Shield...)
-- instead of one flat alphabetical-by-date list. JP/CN sets carry a flat
-- region label here ("Japon"/"Chine", see REGION_SERIES_LABEL in
-- sync-tcgdex-cards.ts), not a real per-era value, so they stay single-level
-- (region only) in that grouping — nothing to sub-group them by yet.
CREATE OR REPLACE VIEW public.tcg_sets WITH (security_invoker = on) AS
SELECT DISTINCT ON (set_id)
  set_id,
  set_name,
  release_date,
  count(*) OVER (PARTITION BY set_id) AS card_count,
  set_symbol,
  set_logo,
  region,
  series
FROM public.tcg_cards
ORDER BY set_id, release_date DESC NULLS LAST;
