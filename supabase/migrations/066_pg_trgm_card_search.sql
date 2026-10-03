-- Fast fuzzy name matching for scripts/scan-card's OCR pipeline (Edge Function) —
-- once a card-number fraction narrows candidates down to a handful of sets, this
-- ranks them by how closely the OCR-detected name text matches tcg_cards.name,
-- across ~40k rows including JP/CN scripts (trigram similarity doesn't care about
-- alphabet, unlike a language-specific full-text search config).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX tcg_cards_name_trgm_idx ON public.tcg_cards USING gin (name gin_trgm_ops);

-- One RPC covers both cases the Edge Function needs: pure name search across
-- the whole catalog (candidate_ids omitted, uses the trigram index above),
-- and ranking an already-narrowed set of candidates by name similarity
-- (candidate_ids passed in, e.g. after filtering by card number + set size).
CREATE OR REPLACE FUNCTION public.search_cards_by_name(
  query_text text,
  candidate_ids text[] DEFAULT NULL,
  match_limit int DEFAULT 5
)
RETURNS TABLE (
  id text, name text, dex_num int2, image_small text, image_large text, set_id text, set_name text, region text, card_number text, rarity text
)
LANGUAGE sql STABLE AS $$
  -- `<->` (trigram distance, ascending = most similar first) rather than
  -- `ORDER BY similarity(...) DESC` — the distance operator is what lets the
  -- GIN trigram index above actually serve this as a fast KNN lookup across
  -- the full ~40k-row catalog when candidate_ids is omitted; a plain
  -- similarity() call in ORDER BY doesn't use the index the same way.
  SELECT id, name, dex_num, image_small, image_large, set_id, set_name, region, card_number, rarity
  FROM public.tcg_cards
  WHERE candidate_ids IS NULL OR id = ANY(candidate_ids)
  ORDER BY name <-> query_text
  LIMIT match_limit;
$$;
