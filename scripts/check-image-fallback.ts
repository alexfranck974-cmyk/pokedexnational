import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SET_TO_TCGPLAYER_GROUP } from './sync-tcgplayer-images';

const {
  SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const url = SUPABASE_URL ?? EXPO_PUBLIC_SUPABASE_URL;
if (!url || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env vars — see .env.example');
}

const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Guards against the 2026-08-24 incident class: sync:tcgdex's raw crawl
// blindly resets every gap-fill/JP set it touches back to the sprite
// fallback, relying on sync:tcgplayer-images running right after to
// re-backfill real art. That's enforced by construction now (sync:tcgdex
// chains both in package.json), but this script is the tripwire for
// everything that construction can't catch — a manual sync:tcgdex:cards-only
// run, a future refactor that breaks the chain, tcgcsv.com/TCGdex changing
// shape so the backfill silently matches nothing. Run right after sync:tcgdex
// in CI; a non-zero exit here should fail that workflow loudly instead of a
// green checkmark hiding a quiet regression.
//
// Not a zero-tolerance check — some sets (e.g. jp-M-P) have a handful of
// cards TCGPlayer's own catalog never had a match for, so a small fallback
// rate is normal there. Only alert when a set is BADLY off from where a
// correct backfill run leaves it.
const FALLBACK_RATE_THRESHOLD = 0.25; // 25% — comfortably above the worst known permanent gap (jp-M-P, ~16%), comfortably below what an actually-broken chain looks like (mep hit ~87% in the incident)

async function main() {
  let anyOverThreshold = false;
  for (const setId of Object.keys(SET_TO_TCGPLAYER_GROUP)) {
    const { count: total, error: totalErr } = await supabase
      .from('tcg_cards')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId);
    if (totalErr) throw totalErr;
    if (!total) { console.log(`  ${setId}: no rows, skipping`); continue; }

    const { count: fallback, error: fallbackErr } = await supabase
      .from('tcg_cards')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId)
      .like('image_small', '%raw.githubusercontent.com%');
    if (fallbackErr) throw fallbackErr;

    const rate = (fallback ?? 0) / total;
    const flag = rate > FALLBACK_RATE_THRESHOLD ? ' ⚠️ OVER THRESHOLD' : '';
    console.log(`  ${setId}: ${fallback}/${total} on sprite fallback (${(rate * 100).toFixed(0)}%)${flag}`);
    if (rate > FALLBACK_RATE_THRESHOLD) anyOverThreshold = true;
  }

  if (anyOverThreshold) {
    console.error('\nOne or more sets are well above their expected sprite-fallback rate — real card art likely got wiped without being re-backfilled. Run `npm run sync:tcgplayer-images` to fix.');
    process.exit(1);
  }
  console.log('\nAll sets within expected fallback rate.');
}

main().catch(e => { console.error(e); process.exit(1); });
