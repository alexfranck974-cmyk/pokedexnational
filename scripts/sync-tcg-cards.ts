import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

interface TcgCard {
  id: string;
  name: string;
  nationalPokedexNumbers?: number[];
  set: { id: string; name: string; series: string; releaseDate: string };
  number: string;
  rarity?: string;
  artist?: string;
  images: { small: string; large?: string };
  cardmarket?: {
    updatedAt?: string;
    prices?: { trendPrice?: number; averageSellPrice?: number; lowPrice?: number };
  };
}

const PAGE_SIZE = 250;

const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ data: TcgCard[]; totalCount: number }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=nationalPokedexNumbers:[1 TO 1025]&pageSize=${PAGE_SIZE}&page=${page}`,
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

function toRow(c: TcgCard) {
  const dex = c.nationalPokedexNumbers?.find(n => n >= 1 && n <= 1025);
  if (!dex) return null;
  return {
    id: c.id,
    name: c.name,
    dex_num: dex,
    set_id: c.set.id,
    set_name: c.set.name,
    card_number: c.number,
    rarity: c.rarity ?? null,
    artist: c.artist ?? null,
    image_small: c.images.small,
    image_large: c.images.large ?? null,
    release_date: c.set.releaseDate ?? null,
    series: c.set.series ?? null,
    cardmarket_trend_eur: c.cardmarket?.prices?.trendPrice ?? null,
    cardmarket_avg_eur: c.cardmarket?.prices?.averageSellPrice ?? null,
    cardmarket_low_eur: c.cardmarket?.prices?.lowPrice ?? null,
    cardmarket_updated_at: c.cardmarket?.updatedAt ? new Date(c.cardmarket.updatedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  let page = 1;
  let total = Infinity;
  let done = 0;
  const failedPages: number[] = [];
  while (done < total) {
    try {
      const { data, totalCount } = await fetchPage(page);
      total = totalCount;
      const rows = data.map(toRow).filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length) {
        const { error } = await supabase.from('tcg_cards').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
      done += data.length;
      console.log(`Page ${page}: ${data.length} cards processed (${done}/${total})`);
    } catch (err) {
      // The upstream API is retried per-page already (see fetchPage); if a page still
      // exhausts retries, skip it rather than aborting the whole sync — re-running the
      // script is idempotent (upsert on id) and will pick up any skipped pages.
      console.error(`Page ${page} failed after all retries, skipping:`, err instanceof Error ? err.message : err);
      failedPages.push(page);
      done += PAGE_SIZE;
    }
    page++;
  }
  console.log(`Done. Total processed: ~${done}.`);
  if (failedPages.length) {
    console.log(`Skipped pages (re-run the script to retry them): ${failedPages.join(', ')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
