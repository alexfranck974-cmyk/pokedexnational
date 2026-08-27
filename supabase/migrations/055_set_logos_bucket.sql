-- Public bucket for set logo images we re-host ourselves — currently used for
-- JP set logos backfilled from PokeWallet's API (see
-- scripts/sync-pokewallet-jp-logos.ts). That API requires an X-API-Key header
-- on every request, so we can't just store their URL in tcg_cards.set_logo
-- and hotlink it client-side (would leak our key to every app user, and 401
-- anyway with no key attached) — the sync script downloads each image once
-- and uploads it here instead, then stores our own public URL.
-- Public + read-only via RLS: only the sync script (service_role, bypasses
-- RLS) ever writes here, same posture as tcg_cards itself.
INSERT INTO storage.buckets (id, name, public)
VALUES ('set-logos', 'set-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "set_logos_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'set-logos');
