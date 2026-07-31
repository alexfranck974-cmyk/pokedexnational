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

// Backfills real card images (from TCGPlayer, via the free/no-auth tcgcsv.com
// mirror) for rows that are on the sprite-fallback path because TCGdex has no
// image for them yet — see toRow() in sync-tcgdex-cards.ts. Only touches rows
// currently on that fallback (image_small still pointing at raw.githubusercontent.com),
// so it's safe to re-run and never clobbers a real TCGdex image.
//
// Hand-maintained set_id -> TCGPlayer group mapping, same philosophy as
// EN_GAP_SET_IDS in sync-tcgdex-cards.ts: only sets we've manually confirmed
// exist as a matching TCGPlayer group, not an automatic name-based guess.
// "jp-MC" (スタートデッキ100 バトルコレクション, 653 sprite-fallback rows) was
// deliberately left out — TCGdex bundles multiple distinct starter-deck
// products under that one set_id, and no single TCGPlayer group lines up
// with it cleanly enough to trust a card_number match.
const SET_TO_TCGPLAYER_GROUP: Record<string, { categoryId: number; groupId: number }> = {
  mep: { categoryId: 3, groupId: 24451 }, // ME: Mega Evolution Promo
  'jp-M1L': { categoryId: 85, groupId: 24399 }, // m1L: Mega Brave
  'jp-M1S': { categoryId: 85, groupId: 24400 }, // m1S: Mega Symphonia
  'jp-M2': { categoryId: 85, groupId: 24459 }, // M2: Inferno X
  'jp-M2a': { categoryId: 85, groupId: 24499 }, // M2a: High Class Pack: MEGA Dream ex
  'jp-M3': { categoryId: 85, groupId: 24600 }, // M3: Nihil Zero
  'jp-M4': { categoryId: 85, groupId: 24653 }, // M4: Ninja Spinner
  'jp-M5': { categoryId: 85, groupId: 24711 }, // M5: Abyss Eye
  'jp-M-P': { categoryId: 85, groupId: 24423 }, // M-P Promotional Cards
  'jp-SV11B': { categoryId: 85, groupId: 24349 }, // SV11B: Black Bolt
  'jp-SV11W': { categoryId: 85, groupId: 24350 }, // SV11W: White Flare
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

interface TcgPlayerProduct {
  productId: number;
  name: string;
  imageUrl: string | null;
  extendedData?: { name: string; value: string }[];
}
interface TcgPlayerListResponse<T> { results: T[]; }

interface DbRow { id: string; card_number: string; }

// TCGPlayer's "Number" field is "005" for promos or "005/086" for regular sets;
// our card_number is always the plain zero-padded left side.
function numberKey(raw: string): string {
  const left = raw.split('/')[0].trim();
  return left.padStart(3, '0');
}

async function buildProductIndex(categoryId: number, groupId: number): Promise<Map<string, TcgPlayerProduct>> {
  const { results } = await fetchJson<TcgPlayerListResponse<TcgPlayerProduct>>(
    `https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/products`,
  );
  const index = new Map<string, TcgPlayerProduct>();
  for (const p of results) {
    if (!p.imageUrl) continue;
    const numberField = p.extendedData?.find(e => e.name === 'Number')?.value;
    if (!numberField) continue;
    const key = numberKey(numberField);
    const existing = index.get(key);
    // Prefer the "base" printing over parenthetical variants (e.g. "(Pokemon
    // Center Exclusive)", "(Reverse Holo)") when a product name has both.
    if (!existing || (existing.name.includes('(') && !p.name.includes('('))) {
      index.set(key, p);
    }
  }
  return index;
}

async function syncSet(setId: string, group: { categoryId: number; groupId: number }) {
  const { data: rows, error } = await supabase
    .from('tcg_cards')
    .select('id, card_number')
    .eq('set_id', setId)
    .like('image_small', '%raw.githubusercontent.com%')
    .returns<DbRow[]>();
  if (error) throw error;
  if (!rows.length) {
    console.log(`  ${setId}: no sprite-fallback rows left, skipping`);
    return;
  }

  const index = await buildProductIndex(group.categoryId, group.groupId);
  let matched = 0;
  for (const row of rows) {
    const product = index.get(numberKey(row.card_number));
    if (!product) continue;
    const image = `https://tcgplayer-cdn.tcgplayer.com/product/${product.productId}_400w.jpg`;
    const { error: updErr } = await supabase
      .from('tcg_cards')
      .update({ image_small: image, image_large: image, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updErr) { console.error(`    ${row.id} update failed:`, updErr.message); continue; }
    matched++;
  }
  console.log(`  ${setId}: ${matched}/${rows.length} matched`);
}

// Cards TCGdex's own "mep" set data doesn't have at all yet (not even a
// sprite-fallback row — no row exists), but that TCGPlayer already carries.
// Unlike the image backfill above, there's no dexId to lean on here, so each
// entry below was verified by hand against data/pokedex.json's name_en — not
// derived by parsing the TCGPlayer card name (regional forms, "Mega X ex",
// "N's X" prefixes, and Trainer/Energy cards like "Celebratory Fanfare" make
// that too easy to get wrong). Ids follow TCGdex's own `mep-XXX` convention on
// purpose: if TCGdex adds real data for one of these later, insertMissingMepCards
// skips ids that already exist, so it never clobbers TCGdex's own row once it
// shows up — these are a stopgap, not a permanent override.
const MEP_MISSING_CARDS: { number: string; dexNum: number; name: string; productId: number }[] = [
  { number: '046', dexNum: 152, name: 'Chikorita', productId: 699870 },
  { number: '047', dexNum: 155, name: 'Cyndaquil', productId: 699871 },
  { number: '048', dexNum: 158, name: 'Totodile', productId: 699872 },
  { number: '049', dexNum: 495, name: 'Snivy', productId: 699873 },
  { number: '050', dexNum: 498, name: 'Tepig', productId: 699874 },
  { number: '051', dexNum: 501, name: 'Oshawott', productId: 699875 },
  { number: '052', dexNum: 810, name: 'Grookey', productId: 699876 },
  { number: '053', dexNum: 813, name: 'Scorbunny', productId: 699877 },
  { number: '054', dexNum: 816, name: 'Sobble', productId: 699878 },
  { number: '072', dexNum: 36, name: 'Mega Clefable ex', productId: 696607 },
  { number: '073', dexNum: 94, name: 'Mega Gengar ex', productId: 696608 },
  { number: '081', dexNum: 658, name: 'Mega Greninja ex', productId: 704879 },
  { number: '082', dexNum: 1008, name: 'Miraidon', productId: 706135 },
  { number: '083', dexNum: 80, name: 'Slowbro', productId: 706129 },
  { number: '084', dexNum: 781, name: 'Dhelmise', productId: 706137 },
  { number: '085', dexNum: 411, name: 'Bastiodon', productId: 706133 },
  { number: '086', dexNum: 79, name: 'Slowpoke', productId: 706130 },
  { number: '087', dexNum: 688, name: 'Binacle', productId: 706131 },
  { number: '088', dexNum: 893, name: 'Zarude', productId: 706193 },
];

async function insertMissingMepCards() {
  console.log('\n=== mep: missing-from-TCGdex cards ===');
  const { data: existing, error } = await supabase
    .from('tcg_cards')
    .select('id')
    .eq('set_id', 'mep')
    .returns<{ id: string }[]>();
  if (error) throw error;
  const existingIds = new Set(existing.map(r => r.id));

  const toInsert = MEP_MISSING_CARDS
    .filter(c => !existingIds.has(`mep-${c.number}`))
    .map(c => ({
      id: `mep-${c.number}`,
      name: c.name,
      dex_num: c.dexNum,
      set_id: 'mep',
      set_name: 'MEP Black Star Promos',
      card_number: c.number,
      rarity: 'Promo',
      artist: null,
      image_small: `https://tcgplayer-cdn.tcgplayer.com/product/${c.productId}_400w.jpg`,
      image_large: `https://tcgplayer-cdn.tcgplayer.com/product/${c.productId}_400w.jpg`,
      release_date: '2025-09-26', // same as the rest of the mep set (from TCGdex's set.releaseDate)
      series: null,
      cardmarket_trend_eur: null,
      cardmarket_avg_eur: null,
      cardmarket_low_eur: null,
      cardmarket_updated_at: null,
      region: 'global',
      supertype: 'Pokémon',
      updated_at: new Date().toISOString(),
    }));

  if (!toInsert.length) {
    console.log('  nothing to insert, all already present');
    return;
  }
  const { error: insErr } = await supabase.from('tcg_cards').insert(toInsert);
  if (insErr) throw insErr;
  console.log(`  inserted ${toInsert.length}/${MEP_MISSING_CARDS.length}`);
}

async function main() {
  for (const [setId, group] of Object.entries(SET_TO_TCGPLAYER_GROUP)) {
    console.log(`\n=== ${setId} ===`);
    await syncSet(setId, group);
  }
  await insertMissingMepCards();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
