-- Exposes region on the tcg_sets view so the client can show a flag +
-- English name for JP/CN sets instead of relying on the untranslated native
-- set name (see lib/tcg-set-labels.ts). Appended at the end — CREATE OR
-- REPLACE VIEW only allows adding columns there, not inserting/reordering.
CREATE OR REPLACE VIEW public.tcg_sets WITH (security_invoker = on) AS
SELECT DISTINCT ON (set_id)
  set_id,
  set_name,
  release_date,
  count(*) OVER (PARTITION BY set_id) AS card_count,
  set_symbol,
  set_logo,
  region
FROM public.tcg_cards
ORDER BY set_id, release_date DESC NULLS LAST;
