-- Adds a per-set total card count to the existing tcg_sets view (needed by the
-- set-goals progress feature). Additive column, safe under CREATE OR REPLACE
-- VIEW since it's appended after the existing columns.
CREATE OR REPLACE VIEW public.tcg_sets WITH (security_invoker = on) AS
SELECT DISTINCT ON (set_id)
  set_id,
  set_name,
  release_date,
  count(*) OVER (PARTITION BY set_id) AS card_count
FROM public.tcg_cards
ORDER BY set_id, release_date DESC NULLS LAST;
