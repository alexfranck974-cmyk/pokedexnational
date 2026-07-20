CREATE VIEW public.user_dex WITH (security_invoker = on) AS
SELECT DISTINCT uc.user_id, tc.dex_num
FROM public.user_cards uc
JOIN public.tcg_cards tc ON tc.id = uc.card_id
WHERE tc.dex_num BETWEEN 1 AND 1025;

CREATE VIEW public.pokemon_tcg_index WITH (security_invoker = on) AS
SELECT
  dex_num,
  array_agg(DISTINCT set_id)                                     AS set_ids,
  array_agg(DISTINCT rarity) FILTER (WHERE rarity IS NOT NULL)   AS rarities
FROM public.tcg_cards
WHERE dex_num BETWEEN 1 AND 1025
GROUP BY dex_num;
