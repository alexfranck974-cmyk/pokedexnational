import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Lightweight companion to sync-tcg-cards.ts, same shape as sync-tcg-prices.ts:
// asks pokemontcg.io for only `id` + `tcgplayer` via the `select` query param,
// derives which finishes (normal/holo/reverse_holo) each print actually comes
// in from the keys of tcgplayer.prices, and writes that to
// tcg_cards.available_finishes. One-time backfill + re-run whenever new sets
// are synced (sync-tcg-cards.ts also captures this going forward).

const {
  SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  POKEMON_TCG_API_KEY,
} = process.env;

const url = SUPABASE_URL ?? EXPO_PUBLIC_SUPABASE_URL;
if (!url || !SUPABASE_SERVICE_ROLE_KEY || !POKEMON_TCG_API_KEY) {
  throw new Error('Missing env vars — see .env.example');
}

const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface TcgFinishRow {
  id: string;
  tcgplayer?: { prices?: Record<string, unknown> };
}

// pokemontcg.io's tcgplayer.prices keys → our finish vocabulary (lib/collection.ts's
// OwnedCardFinish). 1st-edition variants still count as "normal"/"holo" prints for
// this purpose — we don't track 1st-edition-ness as its own finish.
function finishesFromPriceKeys(keys: string[]): string[] {
  const finishes = new Set<string>();
  for (const key of keys) {
    if (key === 'normal' || key === 'unlimited' || key === '1stEditionNormal') finishes.add('normal');
    if (key === 'holofoil' || key === 'unlimitedHolofoil' || key === '1stEditionHolofoil') finishes.add('holo');
    if (key === 'reverseHolofoil') finishes.add('reverse_holo');
  }
  return Array.from(finishes);
}

const PAGE_SIZE = 250;
const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ data: TcgFinishRow[]; totalCount: number }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=nationalPokedexNumbers:[1 TO 1025]&select=id,tcgplayer&pageSize=${PAGE_SIZE}&page=${page}`,
        { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY! } },
      );
      if (res.ok) return res.json();
      if (res.status >= 500 || res.status === 429) {
        const backoff = 2 ** attempt * 500;
        console.warn(`Page ${page} attempt ${attempt}: ${res.status}, retrying in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      throw new Error(`Fetch page ${page} → ${res.status} (non-retriable)`);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const backoff = 2 ** attempt * 500;
        console.warn(`Page ${page} attempt ${attempt} threw, retrying in ${backoff}ms:`, err);
        await sleep(backoff);
      }
    }
  }
  throw lastErr ?? new Error(`Fetch page ${page} exhausted retries`);
}

async function main() {
  let page = 1;
  let total = Infinity;
  let done = 0;
  let updated = 0;
  const failedPages: number[] = [];
  while (done < total) {
    try {
      const { data, totalCount } = await fetchPage(page);
      total = totalCount;
      const finishesById = new Map<string, string[]>();
      for (const c of data) {
        const keys = Object.keys(c.tcgplayer?.prices ?? {});
        if (keys.length) finishesById.set(c.id, finishesFromPriceKeys(keys));
      }

      if (finishesById.size) {
        // Same NOT NULL gotcha as sync-tcg-prices.ts: a partial-column upsert
        // fails Postgres' NOT NULL checks on this table's many other required
        // columns even though we only mean to touch one column. Fetch the
        // existing full rows and upsert them back with just this field changed.
        const ids = Array.from(finishesById.keys());
        const { data: existing, error: selErr } = await supabase
          .from('tcg_cards')
          .select('*')
          .in('id', ids);
        if (selErr) throw selErr;

        const rows = (existing ?? []).map(row => ({
          ...row,
          available_finishes: finishesById.get(row.id)!,
          updated_at: new Date().toISOString(),
        }));

        if (rows.length) {
          const { error } = await supabase.from('tcg_cards').upsert(rows, { onConflict: 'id' });
          if (error) throw error;
          updated += rows.length;
        }
      }
      done += data.length;
      console.log(`Page ${page}: ${finishesById.size}/${data.length} cards had tcgplayer price data (${done}/${total})`);
    } catch (err) {
      console.error(`Page ${page} failed after all retries, skipping:`, err instanceof Error ? err.message : err);
      failedPages.push(page);
      done += PAGE_SIZE;
    }
    page++;
  }
  console.log(`Done. available_finishes updated for ~${updated} cards (of ~${done} checked).`);
  if (failedPages.length) {
    console.log(`Skipped pages (re-run the script to retry them): ${failedPages.join(', ')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
