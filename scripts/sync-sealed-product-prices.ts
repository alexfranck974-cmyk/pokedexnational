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
  // Batch added 2026-09-02 — every mainline SV set plus the tail end of SWSH,
  // same card-#1-name cross-check as the block above (all 21 verified clean,
  // no mismatches). "Trainer Gallery" subsets, McDonald's promos, and other
  // non-standalone-purchased groups deliberately skipped — they're not sold
  // as their own booster box/ETB/booster, they ride inside the parent set's.
  sv10: { categoryId: 3, groupId: 24269 }, // Destined Rivals
  sv9: { categoryId: 3, groupId: 24073 }, // Journey Together
  sv8: { categoryId: 3, groupId: 23651 }, // Surging Sparks
  sv7: { categoryId: 3, groupId: 23537 }, // Stellar Crown
  sv6pt5: { categoryId: 3, groupId: 23529 }, // Shrouded Fable
  sv6: { categoryId: 3, groupId: 23473 }, // Twilight Masquerade
  sv5: { categoryId: 3, groupId: 23381 }, // Temporal Forces
  sv4pt5: { categoryId: 3, groupId: 23353 }, // Paldean Fates
  sv4: { categoryId: 3, groupId: 23286 }, // Paradox Rift
  sv3pt5: { categoryId: 3, groupId: 23237 }, // 151
  sv3: { categoryId: 3, groupId: 23228 }, // Obsidian Flames
  sv2: { categoryId: 3, groupId: 23120 }, // Paldea Evolved
  sv1: { categoryId: 3, groupId: 22873 }, // Scarlet & Violet Base Set
  swsh12pt5: { categoryId: 3, groupId: 17688 }, // Crown Zenith
  swsh12: { categoryId: 3, groupId: 3170 }, // Silver Tempest
  swsh11: { categoryId: 3, groupId: 3118 }, // Lost Origin
  pgo: { categoryId: 3, groupId: 3064 }, // Pokemon GO
  swsh10: { categoryId: 3, groupId: 3040 }, // Astral Radiance
  swsh9: { categoryId: 3, groupId: 2948 }, // Brilliant Stars
  swsh8: { categoryId: 3, groupId: 2906 }, // Fusion Strike
  cel25: { categoryId: 3, groupId: 2867 }, // Celebrations

  // Added 2026-09-04 — a full audit found sealed_product_prices had zero
  // coverage for every SM/older-SWSH/XY/e-card global set and every single
  // JP set (46 of them). This batch covers what's verifiably matchable:
  //
  // JP entries below are pure reuse of groupIds already hand-verified for
  // sync-tcgplayer-images.ts/sync-tcgplayer-prices.ts (same TCGPlayer group,
  // no new verification needed — see jp-SV4a's comment there re: the
  // "レイジングサーフ" name collision with jp-SV3a, still applies here).
  'jp-M1L': { categoryId: 85, groupId: 24399 },
  'jp-M1S': { categoryId: 85, groupId: 24400 },
  'jp-M2': { categoryId: 85, groupId: 24459 },
  'jp-M2a': { categoryId: 85, groupId: 24499 },
  'jp-M3': { categoryId: 85, groupId: 24600 },
  'jp-M4': { categoryId: 85, groupId: 24653 },
  'jp-M5': { categoryId: 85, groupId: 24711 },
  'jp-M-P': { categoryId: 85, groupId: 24423 },
  'jp-SV11B': { categoryId: 85, groupId: 24349 },
  'jp-SV11W': { categoryId: 85, groupId: 24350 },
  'jp-SV5M': { categoryId: 85, groupId: 23613 },
  'jp-SV-P': { categoryId: 85, groupId: 23779 },
  'jp-SV4a': { categoryId: 85, groupId: 23601 }, // Shiny Treasure ex (labelled "レイジングサーフ" — do not confuse with jp-SV3a/23600)
  'jp-SV8a': { categoryId: 85, groupId: 23909 },
  'jp-SV6': { categoryId: 85, groupId: 23614 },
  'jp-SV10': { categoryId: 85, groupId: 24310 },
  'jp-SV9a': { categoryId: 85, groupId: 24260 },

  // English entries below are new for this file — each confirmed to have a
  // real Booster Box/ETB/Booster Pack product in its TCGPlayer group before
  // being added (not just a name match). Promo sets (swshp, smp, xyp, svp)
  // deliberately excluded — same reasoning as the "non-standalone-purchased"
  // note above, confirmed they have zero matching products either way.
  // ecard1-3/pl3/bw7 only match 1-2 of the 3 types (ETB didn't exist as a
  // product line yet in those eras) — expected, not a bug.
  swsh1: { categoryId: 3, groupId: 2585 },  // Sword & Shield
  swsh2: { categoryId: 3, groupId: 2626 },  // Rebel Clash
  swsh3: { categoryId: 3, groupId: 2675 },  // Darkness Ablaze
  swsh4: { categoryId: 3, groupId: 2701 },  // Vivid Voltage
  swsh5: { categoryId: 3, groupId: 2765 },  // Battle Styles
  swsh6: { categoryId: 3, groupId: 2807 },  // Chilling Reign
  swsh7: { categoryId: 3, groupId: 2848 },  // Evolving Skies
  sm1: { categoryId: 3, groupId: 1863 },    // Sun & Moon
  sm2: { categoryId: 3, groupId: 1919 },    // Guardians Rising
  sm3: { categoryId: 3, groupId: 1957 },    // Burning Shadows
  sm5: { categoryId: 3, groupId: 2178 },    // Ultra Prism
  sm7: { categoryId: 3, groupId: 2278 },    // Celestial Storm
  sm8: { categoryId: 3, groupId: 2328 },    // Lost Thunder
  sm9: { categoryId: 3, groupId: 2377 },    // Team Up
  sm10: { categoryId: 3, groupId: 2420 },   // Unbroken Bonds
  sm11: { categoryId: 3, groupId: 2464 },   // Unified Minds
  sm12: { categoryId: 3, groupId: 2534 },   // Cosmic Eclipse
  xy5: { categoryId: 3, groupId: 1509 },    // Primal Clash
  xy8: { categoryId: 3, groupId: 1661 },    // BREAKthrough
  ecard1: { categoryId: 3, groupId: 1375 }, // Expedition Base Set
  ecard2: { categoryId: 3, groupId: 1397 }, // Aquapolis
  ecard3: { categoryId: 3, groupId: 1372 }, // Skyridge
  pl3: { categoryId: 3, groupId: 1384 },    // Supreme Victors
  bw7: { categoryId: 3, groupId: 1408 },    // Boundaries Crossed

  // Added 2026-09-04 (part 2) — the rest of the JP catalog. Found via
  // TCGPlayer's own `abbreviation` field on each group (an exact, authoritative
  // match to our jp-<code> set ids — no name-collision risk the way matching
  // by Japanese display name would have, see jp-SV4a's comment above). jp-M6
  // (Storm Emeralda) was verified back when its card images were backfilled
  // but missed being added here at the time — included now. jp-MC and
  // jp-SV-P stay deliberately unmapped: jp-MC bundles multiple starter decks
  // under one set_id (see sync-tcgplayer-images.ts's comment), and jp-SV-P
  // (promo cards) has a group but confirmed zero Booster Box/ETB/Booster
  // products in it, same as the English promo sets above.
  'jp-M6': { categoryId: 85, groupId: 24791 },
  'jp-S9': { categoryId: 85, groupId: 23628 },    // Star Birth
  'jp-S9a': { categoryId: 85, groupId: 23639 },   // Battle Region
  'jp-S10a': { categoryId: 85, groupId: 23640 },  // Dark Phantasma
  'jp-S10P': { categoryId: 85, groupId: 23630 },  // Space Juggler
  'jp-S11': { categoryId: 85, groupId: 23631 },   // Lost Abyss
  'jp-S11a': { categoryId: 85, groupId: 23642 },  // Incandescent Arcana
  'jp-S12': { categoryId: 85, groupId: 23632 },   // Paradigm Trigger
  'jp-S12a': { categoryId: 85, groupId: 23645 },  // VSTAR Universe
  'jp-SV1S': { categoryId: 85, groupId: 23605 },  // Scarlet ex
  'jp-SV1V': { categoryId: 85, groupId: 23606 },  // Violet ex
  'jp-SV1a': { categoryId: 85, groupId: 23598 },  // Triplet Beat
  'jp-SV2a': { categoryId: 85, groupId: 23599 },  // Pokemon Card 151
  'jp-SV2D': { categoryId: 85, groupId: 23608 },  // Clay Burst
  'jp-SV2P': { categoryId: 85, groupId: 23607 },  // Snow Hazard
  'jp-SV3': { categoryId: 85, groupId: 23609 },   // Ruler of the Black Flame
  'jp-SV3a': { categoryId: 85, groupId: 23600 },  // Raging Surf (the real one — see jp-SV4a's comment)
  'jp-SV4K': { categoryId: 85, groupId: 23610 },  // Ancient Roar
  'jp-SV4M': { categoryId: 85, groupId: 23611 },  // Future Flash
  'jp-SV5K': { categoryId: 85, groupId: 23612 },  // Wild Force
  'jp-SV5a': { categoryId: 85, groupId: 23602 },  // Crimson Haze
  'jp-SV6a': { categoryId: 85, groupId: 23603 },  // Night Wanderer
  'jp-SV7': { categoryId: 85, groupId: 23615 },   // Stellar Miracle
  'jp-SV7a': { categoryId: 85, groupId: 23604 },  // Paradise Dragona
  'jp-SV8': { categoryId: 85, groupId: 23777 },   // Super Electric Breaker
  'jp-SV9': { categoryId: 85, groupId: 24173 },   // Battle Partners
  'jp-SVK': { categoryId: 85, groupId: 23794 },   // Stellar Miracle Deck Build Box
  'jp-SVLS': { categoryId: 85, groupId: 23793 },  // Ceruledge ex ("Soulblaze") Stellar Tera Type Starter Set
  'jp-SVLN': { categoryId: 85, groupId: 23798 },  // Sylveon ex Stellar Tera Type Starter Set
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
