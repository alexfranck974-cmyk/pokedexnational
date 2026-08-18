-- Broadcast "a new TCG set landed" feed. tcg_sets (008/024/027/037) is a plain
-- DISTINCT-ON view over tcg_cards with no "first seen" timestamp, so there's
-- no clean existing signal for "this set is new" — this table is that signal,
-- populated by a trigger the moment the first card of a set is ever inserted.
CREATE TABLE public.set_releases (
  set_id text PRIMARY KEY,
  set_name text NOT NULL,
  region text NOT NULL,
  release_date date,
  announced_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill every set that already exists today. Without this, the very next
-- sync (weekly price refresh touches ~17k *existing* cards, or the monthly
-- tcgdex sync) would have the trigger below see ~180 "unknown" set_ids at
-- once and flood every user with "new set" announcements for sets that have
-- been in the app for months.
INSERT INTO public.set_releases (set_id, set_name, region, release_date, announced_at)
SELECT set_id, set_name, region, release_date, now() FROM public.tcg_sets
ON CONFLICT (set_id) DO NOTHING;

ALTER TABLE public.set_releases ENABLE ROW LEVEL SECURITY;
-- Public reference data, same read posture as tcg_cards/tcg_sets/tcg_rarities.
-- No write policy for regular users — only the trigger (running as the sync
-- scripts' service role, which bypasses RLS) ever inserts here.
CREATE POLICY "set_releases_select_all" ON public.set_releases FOR SELECT USING (true);

CREATE TABLE public.set_releases_dismissed (
  set_id text NOT NULL REFERENCES public.set_releases(set_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, user_id)
);
ALTER TABLE public.set_releases_dismissed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "set_releases_dismissed_select_self" ON public.set_releases_dismissed
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "set_releases_dismissed_insert_self" ON public.set_releases_dismissed
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fires on every new card row; ON CONFLICT DO NOTHING makes it a no-op for
-- every card after the first one of a given set, and for every card of an
-- already-known set — cheap enough to leave unconditional rather than only
-- attaching this to specific sync paths (covers sync-tcg-cards.ts and
-- sync-tcgdex-cards.ts identically without either script needing to know
-- about this table).
CREATE OR REPLACE FUNCTION public.announce_new_set()
RETURNS trigger LANGUAGE plpgsql AS $announce_new_set$
BEGIN
  INSERT INTO public.set_releases (set_id, set_name, region, release_date)
  VALUES (NEW.set_id, NEW.set_name, NEW.region, NEW.release_date)
  ON CONFLICT (set_id) DO NOTHING;
  RETURN NEW;
END;
$announce_new_set$;

CREATE TRIGGER tcg_cards_announce_new_set
AFTER INSERT ON public.tcg_cards
FOR EACH ROW EXECUTE FUNCTION public.announce_new_set();
