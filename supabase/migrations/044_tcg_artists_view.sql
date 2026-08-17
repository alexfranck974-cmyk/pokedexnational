-- Distinct-artist index for the new "Artistes" catalog (mirrors tcg_sets /
-- tcg_rarities) — lets the client list every illustrator without pulling the
-- `artist` column across all ~17k tcg_cards rows just to dedupe client-side.
CREATE OR REPLACE VIEW public.tcg_artists WITH (security_invoker = on) AS
SELECT artist, count(*) AS card_count
FROM public.tcg_cards
WHERE artist IS NOT NULL
GROUP BY artist
ORDER BY artist;
