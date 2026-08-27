import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  POKEWALLET_API_KEY,
} = process.env;

const url = SUPABASE_URL ?? EXPO_PUBLIC_SUPABASE_URL;
if (!url || !SUPABASE_SERVICE_ROLE_KEY || !POKEWALLET_API_KEY) {
  throw new Error('Missing env vars — see .env.example');
}

const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Backfills tcg_cards.set_logo for JP sets from PokeWallet's free API
// (pokewallet.io, 100 req/hr on the free tier — plenty for this: 1 list call
// + ~47 image calls per run). TCGdex (our primary JP/CN source) never
// collected set-level logo/symbol art at all — confirmed by reading its own
// source data on GitHub, not just its live API — so this fills a real gap,
// not a duplicate of anything else.
//
// CN is deliberately not attempted: PokeWallet's Chinese catalog uses an
// older "CSxxC"-style numbering that doesn't line up with the "SV7"/"SV8"-etc
// ids TCGdex gives our actual stored CN sets (2026-08 audit — 0/8 matched).
// Revisit if that changes.
//
// PokeWallet only exposes one image per set (a wide wordmark logo) — there's
// no separate small "symbol" icon endpoint, so this only ever fills
// set_logo, never set_symbol.
//
// The API requires an X-API-Key header on every request, so we can't just
// store PokeWallet's own URL in set_logo and hotlink it client-side (would
// either 401 for real users with no key, or leak our key to all of them if
// embedded) — each image is downloaded once here and re-uploaded to our own
// public 'set-logos' Storage bucket (055_set_logos_bucket.sql), and it's our
// own public URL that ends up in the database.
const MAX_RETRIES = 5;
const REQUEST_GAP_MS = 1000; // stay comfortably under the 100/hr free-tier limit
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'X-API-Key': POKEWALLET_API_KEY! } });
      if (res.ok || res.status === 404) return res; // 404 is a real, non-retriable answer (no image for this set)
      if (res.status >= 500 || res.status === 429) {
        const backoff = 2 ** attempt * 1000;
        console.warn(`  ${url} -> ${res.status}, retrying in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(2 ** attempt * 1000);
    }
  }
  throw lastErr ?? new Error(`${url} exhausted retries`);
}

interface PokeWalletSet {
  name: string;
  set_code: string | null;
  set_id: string;
  card_count: number;
  language: string | null;
  release_date: string | null;
}

async function main() {
  const listRes = await fetchWithRetry('https://api.pokewallet.io/sets');
  if (!listRes.ok) throw new Error(`Failed to list PokeWallet sets: ${listRes.status}`);
  const { data: pwSets } = (await listRes.json()) as { data: PokeWalletSet[] };

  // Keyed by lowercase set_code + language — PokeWallet reuses the same
  // set_code across languages (e.g. "SV10" for both a JP and an unrelated
  // entry), so language has to be part of the key or JP/CN could silently
  // cross-match (bit us once already during manual testing).
  const pwByKey = new Map<string, PokeWalletSet>();
  for (const s of pwSets) {
    if (!s.set_code) continue;
    pwByKey.set(`${s.set_code.toLowerCase()}:${s.language}`, s);
  }

  const { data: ourSets, error } = await supabase
    .from('tcg_sets')
    .select('set_id, set_name')
    .eq('region', 'jp');
  if (error) throw error;

  console.log(`\n=== jp (${ourSets?.length ?? 0} sets) ===`);
  let uploaded = 0, skipped = 0, failed = 0;
  for (const set of ourSets ?? []) {
    const bareId = set.set_id.replace(/^jp-/, '');
    const match = pwByKey.get(`${bareId.toLowerCase()}:jap`);
    if (!match) {
      console.log(`  ${set.set_id}: no PokeWallet match, skipping`);
      skipped++;
      continue;
    }

    await sleep(REQUEST_GAP_MS);
    const imgRes = await fetchWithRetry(`https://api.pokewallet.io/sets/${match.set_code}/image`);
    if (!imgRes.ok) {
      console.log(`  ${set.set_id}: image request → ${imgRes.status}, skipping`);
      failed++;
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength < 500) {
      console.log(`  ${set.set_id}: image response too small (${buf.byteLength}B), skipping`);
      failed++;
      continue;
    }

    const path = `jp/${set.set_id}.png`;
    const { error: upErr } = await supabase.storage.from('set-logos').upload(path, buf, {
      contentType: 'image/png',
      upsert: true,
    });
    if (upErr) {
      console.error(`  ${set.set_id}: storage upload failed:`, upErr.message);
      failed++;
      continue;
    }

    const { data: pub } = supabase.storage.from('set-logos').getPublicUrl(path);
    const { error: updErr } = await supabase.from('tcg_cards').update({ set_logo: pub.publicUrl }).eq('set_id', set.set_id);
    if (updErr) {
      console.error(`  ${set.set_id}: tcg_cards update failed:`, updErr.message);
      failed++;
      continue;
    }

    console.log(`  ${set.set_id}: logo uploaded`);
    uploaded++;
  }

  console.log(`\nDone. uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
