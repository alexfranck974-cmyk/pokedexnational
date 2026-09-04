import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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

// Backfills prices (from TCGPlayer, via the free/no-auth tcgcsv.com mirror
// already used by sync-tcgplayer-images.ts) for cards whose cardmarket_trend_eur
// is still null after the regular pokemontcg.io/TCGdex price syncs — confirmed
// by hand (2026-08-19) that pokemontcg.io's API genuinely carries zero
// cardmarket data for the global sets below (verified via a direct
// ?select=id,cardmarket query returning no cardmarket key at all), and that
// TCGdex's live cardmarket cache is likewise empty for the JP sets below — not
// a bug in sync-tcg-prices.ts/sync-tcgdex-cards.ts. TCGPlayer prices are USD;
// converted to EUR at a live rate fetched once per run from frankfurter.app
// (free, no key, ECB-backed). Only ever writes rows still null, so it's safe
// to re-run and never overwrites a real Cardmarket price if the regular sync
// picks one up later. CN has no TCGPlayer category and Cardmarket's own API is
// currently closed to new applicants (checked 2026-08-19) — no source for CN
// gaps right now. JP gaps are spread across ~30 sets total; only the 6 biggest
// are mapped below, not the full list.
const SET_TO_TCGPLAYER_GROUP: Record<string, { categoryId: number; groupId: number }> = {
  me1: { categoryId: 3, groupId: 24380 },      // ME01: Mega Evolution
  me2: { categoryId: 3, groupId: 24448 },      // ME02: Phantasmal Flames
  me2pt5: { categoryId: 3, groupId: 24541 },   // ME: Ascended Heroes
  me3: { categoryId: 3, groupId: 24587 },      // ME03: Perfect Order
  me4: { categoryId: 3, groupId: 24655 },      // ME04: Chaos Rising
  me5: { categoryId: 3, groupId: 24688 },      // ME05: Pitch Black
  sv8pt5: { categoryId: 3, groupId: 23821 },   // SV: Prismatic Evolutions

  // Added 2026-09-04 — a full-global-region audit found these 8 sets 100%
  // missing a price (vs. ~1% for the rest of global), each verified by hand
  // (card #1/#2 name cross-checked, same as everywhere else in this file).
  // Explicitly NOT added: tk1a/tk1b (EX Trainer Kit 1: Latias & Latios) and
  // tk2a/tk2b (EX Trainer Kit 2: Plusle & Minun) — TCGPlayer bundles both
  // half-decks of each kit into one group with genuinely overlapping Number
  // values (e.g. "Arcanine" and "Beldum" are both "1/12" in group 1542,
  // one per half-deck), so a plain number-keyed match would silently assign
  // the wrong price to about half the cards in each kit. No safe fix here
  // without a hand-built per-card list like MEP_MISSING_CARDS, not worth it
  // for ~24 low-value promo cards total.
  dpp: { categoryId: 3, groupId: 1421 },     // Diamond and Pearl Promos
  hsp: { categoryId: 3, groupId: 1453 },     // HGSS Promos
  cel25c: { categoryId: 3, groupId: 2931 },  // Celebrations: Classic Collection
  sve: { categoryId: 3, groupId: 24382 },    // SVE: Scarlet & Violet Energies
  mcd14: { categoryId: 3, groupId: 1692 },   // McDonald's Promos 2014
  mcd15: { categoryId: 3, groupId: 1694 },   // McDonald's Promos 2015
  mcd17: { categoryId: 3, groupId: 2148 },   // McDonald's Promos 2017
  mcd18: { categoryId: 3, groupId: 2364 },   // McDonald's Promos 2018

  // JP sets — TCGPlayer's "Pokemon Japan" category (85), same real-market-price
  // rationale as above, chosen as the 6 biggest JP price gaps (top ~54% of all
  // missing JP cards) rather than every gap set — see sync:tcgplayer-prices plan
  // notes. Each entry cross-checked by hand against 2-3 dex_num rows before
  // being added, not matched by Japanese set-name string: our own data stores
  // jp-SV4a's display name as "レイジングサーフ", the exact same Japanese name
  // jp-SV3a uses (a known collision, see JP_SET_NAME_EN's comment in
  // lib/tcg-set-labels.ts) — but jp-SV4a's real underlying set is "Shiny
  // Treasure ex" (groupId 23601), a completely different, much bigger set than
  // "SV3a: Raging Surf" (groupId 23600, NOT used here). Confirmed via
  // card 001 in both sources being Oddish/ナゾノクサ.
  'jp-SV4a': { categoryId: 85, groupId: 23601 }, // SV4a: Shiny Treasure ex (labelled "レイジングサーフ" in our data — do not confuse with jp-SV3a/23600)
  'jp-SV8a': { categoryId: 85, groupId: 23909 }, // SV8a: Terastal Fest ex
  'jp-SV6': { categoryId: 85, groupId: 23614 },  // SV6: Transformation Mask
  'jp-SV10': { categoryId: 85, groupId: 24310 }, // SV10: The Glory of Team Rocket
  'jp-M1S': { categoryId: 85, groupId: 24400 },  // m1S: Mega Symphonia (same group already used by sync-tcgplayer-images.ts)
  'jp-SV9a': { categoryId: 85, groupId: 24260 }, // SV9a: Heat Wave Arena

  // Added 2026-09-03 — reused straight from sync-tcgplayer-images.ts's own
  // SET_TO_TCGPLAYER_GROUP (same free upside: those entries were already
  // hand-verified there for the image backfill, no separate re-verification
  // needed since it's the same TCGPlayer group either way).
  'jp-M1L': { categoryId: 85, groupId: 24399 },
  'jp-M2': { categoryId: 85, groupId: 24459 },
  'jp-M2a': { categoryId: 85, groupId: 24499 },
  'jp-M3': { categoryId: 85, groupId: 24600 },
  'jp-M4': { categoryId: 85, groupId: 24653 },
  'jp-M5': { categoryId: 85, groupId: 24711 },
  'jp-M6': { categoryId: 85, groupId: 24791 },
  'jp-M-P': { categoryId: 85, groupId: 24423 },
  'jp-SV11B': { categoryId: 85, groupId: 24349 },
  'jp-SV11W': { categoryId: 85, groupId: 24350 },
  'jp-SV5M': { categoryId: 85, groupId: 23613 },
  'jp-SV-P': { categoryId: 85, groupId: 23779 },
};

const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // tcgcsv.com 401s requests with Node's default fetch User-Agent (bot-blocking) —
      // a plain browser-like UA is enough to pass.
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) return res.json() as Promise<T>;
      if (res.status >= 500 || res.status === 429) {
        await sleep(2 ** attempt * 500);
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

async function fetchUsdToEurRate(): Promise<number> {
  try {
    const data = await fetchJson<{ rates: { EUR: number } }>('https://api.frankfurter.app/latest?from=USD&to=EUR');
    if (data.rates?.EUR) return data.rates.EUR;
  } catch (err) {
    console.warn('Live FX rate fetch failed, falling back to a fixed estimate:', err instanceof Error ? err.message : err);
  }
  return 0.92; // fallback: roughly where USD/EUR has sat through 2026 — approximate only, live rate is preferred
}

interface TcgPlayerProduct {
  productId: number;
  name: string;
  extendedData?: { name: string; value: string }[];
}
interface TcgPlayerPrice {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  marketPrice: number | null;
  subTypeName: string;
}
interface TcgPlayerListResponse<T> { results: T[]; }

interface DbRow { id: string; card_number: string; }

// TCGPlayer's "Number" field is "005" for promos or "005/132" for regular sets;
// our card_number is always the plain zero-padded left side.
function numberKey(raw: string): string {
  const left = raw.split('/')[0].trim();
  return left.padStart(3, '0');
}

// Mirrors the finish priority already used app-side (lib/finish-visuals.ts's
// pickPrimaryFinish): holo > reverse holo > normal. Cardmarket's own
// trend/avg/low is a single aggregate per card regardless of finish, so this
// just picks one representative TCGPlayer variant to match that shape.
const SUBTYPE_PRIORITY = ['Holofoil', 'Reverse Holofoil', 'Normal'];

function pickBestPrice(prices: TcgPlayerPrice[]): TcgPlayerPrice | null {
  if (prices.length === 0) return null;
  for (const subtype of SUBTYPE_PRIORITY) {
    const match = prices.find(p => p.subTypeName === subtype);
    if (match) return match;
  }
  return prices[0];
}

async function buildPriceIndex(categoryId: number, groupId: number): Promise<Map<string, TcgPlayerPrice>> {
  const [{ results: products }, { results: prices }] = await Promise.all([
    fetchJson<TcgPlayerListResponse<TcgPlayerProduct>>(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/products`),
    fetchJson<TcgPlayerListResponse<TcgPlayerPrice>>(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/prices`),
  ]);

  const pricesByProduct = new Map<number, TcgPlayerPrice[]>();
  for (const p of prices) {
    const list = pricesByProduct.get(p.productId) ?? [];
    list.push(p);
    pricesByProduct.set(p.productId, list);
  }

  const index = new Map<string, TcgPlayerPrice>();
  for (const product of products) {
    const numberField = product.extendedData?.find(e => e.name === 'Number')?.value;
    if (!numberField) continue;
    const best = pickBestPrice(pricesByProduct.get(product.productId) ?? []);
    if (!best) continue;
    index.set(numberKey(numberField), best);
  }
  return index;
}

async function syncSet(setId: string, group: { categoryId: number; groupId: number }, rate: number) {
  const { data: rows, error } = await supabase
    .from('tcg_cards')
    .select('id, card_number')
    .eq('set_id', setId)
    .is('cardmarket_trend_eur', null)
    .returns<DbRow[]>();
  if (error) throw error;
  if (!rows.length) {
    console.log(`  ${setId}: no rows missing a price, skipping`);
    return;
  }

  const index = await buildPriceIndex(group.categoryId, group.groupId);
  let matched = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const price = index.get(numberKey(row.card_number));
    if (!price) continue;
    const { error: updErr } = await supabase
      .from('tcg_cards')
      .update({
        cardmarket_trend_eur: price.marketPrice != null ? Math.round(price.marketPrice * rate * 100) / 100 : null,
        cardmarket_avg_eur: price.midPrice != null ? Math.round(price.midPrice * rate * 100) / 100 : null,
        cardmarket_low_eur: price.lowPrice != null ? Math.round(price.lowPrice * rate * 100) / 100 : null,
        cardmarket_updated_at: now,
      })
      .eq('id', row.id)
      .is('cardmarket_trend_eur', null); // never clobber a real Cardmarket price written in the meantime
    if (updErr) { console.error(`    ${row.id} update failed:`, updErr.message); continue; }
    matched++;
  }
  console.log(`  ${setId}: ${matched}/${rows.length} matched`);
}

async function main() {
  const rate = await fetchUsdToEurRate();
  console.log(`USD → EUR rate: ${rate}\n`);
  for (const [setId, group] of Object.entries(SET_TO_TCGPLAYER_GROUP)) {
    console.log(`=== ${setId} ===`);
    await syncSet(setId, group, rate);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
