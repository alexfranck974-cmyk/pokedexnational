-- Announced-but-not-yet-released Pokémon TCG sets, scraped from PokeGuardian's
-- upcoming-sets page (scripts/sync-upcoming-sets.ts, weekly cron) — pokemontcg.io
-- and TCGdex only ever list a set once it has actually released (checked their
-- docs/API), so neither existing sync source has this data. Source content and
-- images are hotlinked from a third-party fan site; see the sync script's own
-- comments for the fragility/reuse caveats that come with that.
CREATE TABLE public.upcoming_sets (
  source_id           text         PRIMARY KEY, -- PokeGuardian's own post id for this set announcement
  name                text         NOT NULL,
  region              text         NOT NULL DEFAULT 'international' CHECK (region IN ('international', 'jp')),
  release_date        date,                      -- best-effort parse of release_date_label; null if unparseable
  release_date_label  text         NOT NULL,      -- raw scraped text, always shown even when release_date is null
  image_url           text,
  source_url          text,
  synced_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX upcoming_sets_release_date_idx ON public.upcoming_sets (release_date);

ALTER TABLE public.upcoming_sets ENABLE ROW LEVEL SECURITY;

-- Public read, same as tcg_cards/tcg_sets/tcg_rarities — no user-specific data
-- here. Only the service-role sync script writes (no insert/update/delete policy
-- for anon/authenticated).
CREATE POLICY "upcoming_sets_select_all" ON public.upcoming_sets
FOR SELECT USING (true);
