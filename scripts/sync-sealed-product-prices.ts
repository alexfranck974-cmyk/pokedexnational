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

// Backfills public.sealed_product_prices (062_sealed_product_prices.sql,
// image_url added in 063_sealed_product_images.sql) from TCGPlayer, via the
// same free/no-auth tcgcsv.com mirror already used by
// sync-tcgplayer-images.ts/sync-tcgplayer-prices.ts. Deliberately narrow v1
// scope (2026-08-30): only the handful of most recent/popular global sets,
// hand-verified one by one (card #1's name cross-checked against our own
// tcg_cards row) exactly like those two scripts already do — no automatic
// name-based set matching, same reasoning as their own comments. me1..me5/
// mep/sv8pt5 mappings are the same verified groups those scripts already use;
// zsv10pt5/rsv10pt5 (Black Bolt/White Flare) are new, verified here
// (groupId 24325 -> card #1 "Snivy" matches zsv10pt5 #1; 24326 -> "Sewaddle"
// matches rsv10pt5 #1).
//
// image_url (added 2026-09-01) rides the same TYPE_MATCHERS match as
// price_eur — same 3-of-7 product types, same reasoning (the other 4 have no
// single reliable SKU per set). Unlike price, a missing image isn't a money
// mistake, so it's still captured even on a run where the price lookup comes
// up empty (see the merge-with-existing logic below either way, so neither
// field ever gets silently nulled out by an unrelated miss).
const SET_TO_TCGPLAYER_GROUP: Record<string, { categoryId: number; groupId: number }> = {
  me1: { categoryId: 3, groupId: 24380 },
  me2: { categoryId: 3, groupId: 24448 },
  me2pt5: { categoryId: 3, groupId: 24541 },
  me3: { categoryId: 3, groupId: 24587 },
  me4: { categoryId: 3, groupId: 24655 },
  me5: { categoryId: 3, groupId: 24688 },
  mep: { categoryId: 3, groupId: 24451 },
  sv8pt5: { categoryId: 3, groupId: 23821 },
  zsv10pt5: { categoryId: 3, groupId: 24325 }, // SV: Black Bolt
  rsv10pt5: { categoryId: 3, groupId: 24326 }, // SV: White Flare
};

// Only these 3 of the app's 7 SealedProductType buckets get a reliable
// automatic match within a TCGPlayer group's product list — the rest
// ("display_box", "coffret", "autre", and "blister") either have no
// consistent single TCGPlayer SKU per set (several blister variants coexist
// with no reliable "the" one) or no TCGPlayer equivalent at all (display_box
// and coffret are French retail terms that don't line up 1:1 with any single
// US product name) — better to leave those null than guess wrong on money.
const TYPE_MATCHERS: { type: 'booster_box' | 'etb' | 'booster'; include: RegExp; exclude: RegExp }[] = [
  { type: 'booster_box', include: /Booster Box/i, exclude: /Case|Half|Sleeved/i },
  { type: 'etb', include: /Elite Trainer Box/i, exclude: /Case|Pokemon Center|Exclusive/i },
  { type: 'booster', include: /Booster Pack/i, exclude: /Bundle|Art|Sleeved|Case/i },
];

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
  imageUrl: string | null;
  extendedData?: { name: string; value: string }[];
}

// TCGPlayer's own imageUrl comes back as the small "_200w" thumbnail — same
// CDN, just swap the size suffix for a less blurry catalog/detail image
// (verified 2026-09-01: "_400w" 200s on the same host, no auth needed).
function upsizeImage(url: string | null): string | null {
  return url ? url.replace('_200w.', '_400w.') : null;
}
interface TcgPlayerPrice {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  marketPrice: number | null;
}
interface TcgPlayerListResponse<T> { results: T[]; }

async function syncSet(setId: string, group: { categoryId: number; groupId: number }, rate: number) {
  const [{ results: products }, { results: prices }, { data: existingRows }] = await Promise.all([
    fetchJson<TcgPlayerListResponse<TcgPlayerProduct>>(`https://tcgcsv.com/tcgplayer/${group.categoryId}/${group.groupId}/products`),
    fetchJson<TcgPlayerListResponse<TcgPlayerPrice>>(`https://tcgcsv.com/tcgplayer/${group.categoryId}/${group.groupId}/prices`),
    supabase.from('sealed_product_prices').select('product_type, price_eur, image_url').eq('set_id', setId),
  ]);
  const priceByProduct = new Map(prices.map(p => [p.productId, p]));
  const existingByType = new Map((existingRows ?? []).map(r => [r.product_type, r]));
  // Sealed products are every product in the group without a "Number" field
  // (that field is what identifies an actual numbered card — see the same
  // check in sync-tcgplayer-prices.ts).
  const sealed = products.filter(p => !(p.extendedData ?? []).some(e => e.name === 'Number'));

  const rows: { set_id: string; product_type: string; price_eur: number | null; image_url: string | null; updated_at: string }[] = [];
  const now = new Date().toISOString();
  for (const { type, include, exclude } of TYPE_MATCHERS) {
    const existing = existingByType.get(type);
    const match = sealed.find(p => include.test(p.name) && !exclude.test(p.name));
    if (!match) { console.log(`  ${setId}/${type}: no match`); continue; }
    const price = priceByProduct.get(match.productId);
    const usd = price?.marketPrice ?? price?.midPrice ?? price?.lowPrice ?? null;
    // Merge with whatever's already stored rather than a bare upsert of just
    // this run's fields — PostgREST's upsert treats an omitted column as NULL
    // on the conflict-target row too (same gotcha as sync-tcg-prices.ts, see
    // CLAUDE.md), so a transient price/image miss here would otherwise wipe
    // out a previously-good value instead of just leaving it be.
    const eur = usd != null ? Math.round(usd * rate * 100) / 100 : (existing?.price_eur ?? null);
    const image = upsizeImage(match.imageUrl) ?? existing?.image_url ?? null;
    if (eur == null && image == null) { console.log(`  ${setId}/${type}: matched "${match.name}" but no price or image`); continue; }
    console.log(`  ${setId}/${type}: "${match.name}" -> ${eur != null ? eur + '€' : 'no price'}${image ? ', image ✓' : ''}`);
    rows.push({ set_id: setId, product_type: type, price_eur: eur, image_url: image, updated_at: now });
  }
  if (rows.length === 0) return;
  const { error } = await supabase.from('sealed_product_prices').upsert(rows, { onConflict: 'set_id,product_type' });
  if (error) throw error;
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
