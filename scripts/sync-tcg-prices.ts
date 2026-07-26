import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Lightweight companion to sync-tcg-cards.ts: card metadata (name, images, set,
// rarity, artist) barely ever changes once a set is released, but cardmarket
// prices move every week. Re-running the full sync just to refresh prices means
// downloading full card payloads (images, set info, etc.) for ~20k cards for no
// reason — this script asks the pokemontcg.io API for only `id` + `cardmarket`
// via the `select` query param, cutting the external payload dramatically. Meant
// to run on a schedule (see .github/workflows/sync-tcg-prices.yml).

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

interface TcgPriceRow {
  id: string;
  cardmarket?: {
    updatedAt?: string;
    prices?: { trendPrice?: number; averageSellPrice?: number; lowPrice?: number };
  };
}

const PAGE_SIZE = 250;
const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ data: TcgPriceRow[]; totalCount: number }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=nationalPokedexNumbers:[1 TO 1025]&select=id,cardmarket&pageSize=${PAGE_SIZE}&page=${page}`,
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
      const priceById = new Map<string, TcgPriceRow['cardmarket']>();
      for (const c of data) {
        if (c.cardmarket?.prices) priceById.set(c.id, c.cardmarket);
      }

      if (priceById.size) {
        // Postgres validates NOT NULL constraints on the proposed insert row
        // even when ON CONFLICT DO UPDATE ends up firing — a partial-column
        // upsert (id + price fields only) fails as soon as one of this
        // table's many NOT NULL columns (name, set_id, ...) isn't in the
        // payload, regardless of whether the row already exists. Fetching the
        // existing rows and upserting full rows back sidesteps that.
        const ids = Array.from(priceById.keys());
        const { data: existing, error: selErr } = await supabase
          .from('tcg_cards')
          .select('*')
          .in('id', ids);
        if (selErr) throw selErr;

        const rows = (existing ?? []).map(row => {
          const cardmarket = priceById.get(row.id)!;
          return {
            ...row,
            cardmarket_trend_eur: cardmarket.prices?.trendPrice ?? null,
            cardmarket_avg_eur: cardmarket.prices?.averageSellPrice ?? null,
            cardmarket_low_eur: cardmarket.prices?.lowPrice ?? null,
            cardmarket_updated_at: cardmarket.updatedAt ? new Date(cardmarket.updatedAt).toISOString() : null,
            updated_at: new Date().toISOString(),
          };
        });

        if (rows.length) {
          const { error } = await supabase.from('tcg_cards').upsert(rows, { onConflict: 'id' });
          if (error) throw error;
          updated += rows.length;
        }
        const missing = ids.length - (existing?.length ?? 0);
        if (missing > 0) console.warn(`Page ${page}: ${missing} card id(s) with pricing not found in tcg_cards yet (run npm run sync:tcg to backfill).`);
      }
      done += data.length;
      console.log(`Page ${page}: ${priceById.size}/${data.length} cards had price data (${done}/${total})`);
    } catch (err) {
      console.error(`Page ${page} failed after all retries, skipping:`, err instanceof Error ? err.message : err);
      failedPages.push(page);
      done += PAGE_SIZE;
    }
    page++;
  }
  console.log(`Done. Prices updated for ~${updated} cards (of ~${done} checked).`);
  if (failedPages.length) {
    console.log(`Skipped pages (re-run the script to retry them): ${failedPages.join(', ')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
