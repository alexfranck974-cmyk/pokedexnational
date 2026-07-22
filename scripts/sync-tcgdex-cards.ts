import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pokedexData from '../data/pokedex.json';

const SPRITE_BY_DEX = new Map<number, string>(
  (pokedexData as { num: number; sprite_url: string }[]).map(p => [p.num, p.sprite_url]),
);

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

const CUTOFF_DATE = '2022-01-01';
const MAX_RETRIES = 5;
const CONCURRENCY = 5;
const BATCH_SIZE = 200;

const LOCALES: { locale: string; region: 'jp' | 'cn' }[] = [
  { locale: 'ja', region: 'jp' },
  { locale: 'zh-cn', region: 'cn' },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json() as Promise<T>;
      if (res.status >= 500 || res.status === 429) {
        const backoff = 2 ** attempt * 500;
        await sleep(backoff);
        continue;
      }
      throw new Error(`${url} → ${res.status} (non-retriable)`);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(2 ** attempt * 500);
    }
  }
  throw lastErr ?? new Error(`${url} exhausted retries`);
}

// Small concurrency-limited map — avoids hammering the API with thousands of
// simultaneous requests while still being much faster than fully sequential.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R | null>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        const r = await fn(items[i]);
        if (r !== null) results.push(r);
      } catch (err) {
        console.error(`Item ${i} failed, skipping:`, err instanceof Error ? err.message : err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface SeriesListEntry { id: string; name: string; }
interface SeriesDetail { sets: { id: string; name: string }[]; }
interface SetDetail { id: string; name: string; releaseDate: string | null; cards: { id: string }[]; }
interface CardDetail {
  id: string;
  name: string;
  localId: string;
  rarity?: string;
  illustrator?: string;
  image?: string;
  dexId?: number[];
  set: { id: string; name: string };
  pricing?: { cardmarket?: { trend?: number | null; avg?: number | null; low?: number | null } | null };
}

function toRow(c: CardDetail, region: 'jp' | 'cn', releaseDate: string | null) {
  const dex = c.dexId?.find(n => n >= 1 && n <= 1025);
  if (!dex) return null; // skip Trainer/Energy cards (no dex link)
  // TCGdex doesn't have image assets for every JP/CN card yet (notably: all zh-cn
  // cards seen so far, and several very recent JA sets) — fall back to the Pokémon's
  // official-artwork sprite so the row (and ownership tracking) still exists.
  const spriteFallback = SPRITE_BY_DEX.get(dex);
  const imageSmall = c.image ? `${c.image}/low.webp` : spriteFallback;
  const imageLarge = c.image ? `${c.image}/high.webp` : spriteFallback ?? null;
  if (!imageSmall) return null;
  const prefix = region;
  return {
    id: `${prefix}-${c.id}`,
    name: c.name,
    dex_num: dex,
    set_id: `${prefix}-${c.set.id}`,
    set_name: c.set.name,
    card_number: c.localId,
    rarity: c.rarity ?? null,
    artist: c.illustrator ?? null,
    image_small: imageSmall,
    image_large: imageLarge,
    release_date: releaseDate,
    series: null,
    cardmarket_trend_eur: c.pricing?.cardmarket?.trend ?? null,
    cardmarket_avg_eur: c.pricing?.cardmarket?.avg ?? null,
    cardmarket_low_eur: c.pricing?.cardmarket?.low ?? null,
    cardmarket_updated_at: null,
    region,
    updated_at: new Date().toISOString(),
  };
}

async function upsertBatch(rows: NonNullable<ReturnType<typeof toRow>>[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('tcg_cards').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }
}

async function syncLocale(locale: string, region: 'jp' | 'cn') {
  console.log(`\n=== ${locale} (${region}) ===`);
  const seriesList = await fetchJson<SeriesListEntry[]>(`https://api.tcgdex.net/v2/${locale}/series`);

  const allSets: { id: string; name: string }[] = [];
  for (const s of seriesList) {
    const detail = await fetchJson<SeriesDetail>(`https://api.tcgdex.net/v2/${locale}/series/${s.id}`);
    allSets.push(...detail.sets);
  }
  console.log(`${allSets.length} sets total, checking release dates...`);

  const qualifyingSets: SetDetail[] = [];
  for (const s of allSets) {
    try {
      const set = await fetchJson<SetDetail>(`https://api.tcgdex.net/v2/${locale}/sets/${s.id}`);
      if (set.releaseDate && set.releaseDate >= CUTOFF_DATE) qualifyingSets.push(set);
    } catch (err) {
      console.error(`Set ${s.id} failed, skipping:`, err instanceof Error ? err.message : err);
    }
  }
  const totalCards = qualifyingSets.reduce((n, s) => n + s.cards.length, 0);
  console.log(`${qualifyingSets.length} sets released >= ${CUTOFF_DATE} (${totalCards} cards) — fetching card details...`);

  let done = 0;
  for (const set of qualifyingSets) {
    const rows = await mapLimit(set.cards, CONCURRENCY, async (cardRef) => {
      const card = await fetchJson<CardDetail>(`https://api.tcgdex.net/v2/${locale}/cards/${cardRef.id}`);
      return toRow(card, region, set.releaseDate);
    });
    if (rows.length) await upsertBatch(rows);
    done += set.cards.length;
    console.log(`  ${set.id}: ${rows.length}/${set.cards.length} cards written (${done}/${totalCards} processed)`);
  }
}

async function main() {
  for (const { locale, region } of LOCALES) {
    await syncLocale(locale, region);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
