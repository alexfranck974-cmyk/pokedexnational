-- Distinct sets (one row per set_id) for filter dropdowns.
CREATE VIEW public.tcg_sets WITH (security_invoker = on) AS
SELECT DISTINCT ON (set_id) set_id, set_name, release_date
FROM public.tcg_cards
ORDER BY set_id, release_date DESC NULLS LAST;

-- Distinct rarities for filter dropdowns.
CREATE VIEW public.tcg_rarities WITH (security_invoker = on) AS
SELECT rarity
FROM public.tcg_cards
WHERE rarity IS NOT NULL
GROUP BY rarity;
