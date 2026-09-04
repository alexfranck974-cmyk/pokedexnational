import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pokedexData from '../data/pokedex.json';

const {
  SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PIKAQIAN_API_KEY,
} = process.env;

const url = SUPABASE_URL ?? EXPO_PUBLIC_SUPABASE_URL;
if (!url || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env vars — see .env.example');
}
if (!PIKAQIAN_API_KEY) {
  throw new Error('Missing PIKAQIAN_API_KEY — get a free key at pikaqian.com/account/api-keys');
}

const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Adds Mainland China (Simplified Chinese) cards from the PikaQian API
// (pikaqian.com) as a new, self-contained slice of tcg_cards — real card art
// for a region that had none before (see the 2026-09-04 investigation: our
// existing `cn-*` sets are actually Taiwan/Traditional Chinese, sourced from
// TCGdex's zh-cn locale, which itself has zero card images for the whole
// region; there is no TCGPlayer category for either Chinese market either).
//
// Deliberately NOT an attempt to backfill images onto the existing cn-*
// rows: PikaQian's Mainland sets don't correspond 1:1 to Taiwan's — verified
// by cross-checking cn-SV9a's card sequence against every PikaQian set and
// finding no real match (best overlap was 2/8 cards, coincidental). Mainland
// and Taiwan are different regional product lines with different set
// splits, not the same content re-packaged. So these are inserted as their
// own new sets (id-prefixed `cn-<pikaqian_set_id>`, distinct from the
// existing `cn-SV9`-style ids) rather than merged onto the Taiwan rows —
// genuinely print-exact because we're copying PikaQian's own catalog
// directly, not guessing a cross-region match.
//
// Free tier only (user's explicit choice, 2026-09-04): includes card/set
// images and the "base" print of every card, no market pricing. The card
// LIST endpoint (used here) doesn't expose a Pokédex-number field — only the
// single-card DETAIL endpoint does, which would cost one request per card
// (13,000+, far past the free tier's 500/month) — so dex_num is resolved
// locally by matching the card's English `name` against data/pokedex.json,
// normalized for the usual TCG-name noise (V/VMAX/GX/ex suffixes, tag-team
// "&" pairs, "Trainer's Pokémon" possessives, regional-form prefixes, and
// multi-word forms like "Ice Rider Calyrex" or "Heat Rotom" where the base
// species is the last word) — verified by hand against the full 12,323-card
// crawl on 2026-09-04: 100% of the 9,492 Pokémon-type cards resolved, zero
// false positives on spot-check. Non-Pokémon cards (trainer/supporter/
// stadium/energy) get dex_num null, same as every other region's sync.

const PAGE_SIZE = 100;
const MAX_RETRIES = 5;
const REQUEST_DELAY_MS = 400; // PikaQian's burst limiter kicks in well before the 500/month cap if hit back-to-back
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(path: string): Promise<T> {
  let lastErr: unknown = null;
  // 429 (burst limit) gets its own uncapped loop, not the bounded MAX_RETRIES
  // one below — seen bursts of 5+ consecutive 429s in practice even with
  // REQUEST_DELAY_MS between requests, which blew through a fixed retry
  // budget. It's a transient throttle, not a real failure, so it's always
  // worth waiting out rather than giving up.
  while (true) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`https://api.pikaqian.com${path}`, { headers: { 'X-API-Key': PIKAQIAN_API_KEY! } });
        if (res.ok) return res.json() as Promise<T>;
        if (res.status === 429) break; // fall through to the outer cooldown below
        if (res.status >= 500) { await sleep(2 ** attempt * 500); continue; }
        throw new Error(`${path} → ${res.status} (non-retriable): ${await res.text()}`);
      } catch (err) {
        lastErr = err;
        if (attempt === MAX_RETRIES) throw lastErr;
        await sleep(2 ** attempt * 500);
      }
    }
    await sleep(5000);
  }
}

interface PqSet {
  id: string;
  name: string | null;
  local_name: string;
  series: string;
  release_date: string | null;
  pack_image_url: string | null;
}
interface PqCard {
  id: string;
  card_set_id: string;
  card_number: string;
  name: string;
  local_name: string;
  card_type: 'pokemon' | 'trainer' | 'supporter' | 'stadium' | 'energy';
  rarity: string | null;
  rarity_label: string | null;
  is_variant: boolean;
  image_url: string | null;
}
interface Paginated<T> { data: T[]; pagination: { next_cursor: string | null } }

async function fetchAllPages<T>(path: string): Promise<T[]> {
  let all: T[] = [];
  let cursor: string | null = null;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const page: Paginated<T> = await fetchJson<Paginated<T>>(`${path}${sep}page_size=${PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}`);
    all = all.concat(page.data);
    cursor = page.pagination?.next_cursor ?? null;
    if (!cursor) break;
    await sleep(REQUEST_DELAY_MS);
  }
  return all;
}

const clean = (s: string) => s.toLowerCase().replace(/['’]/g, "'");
const NAME_TO_DEX = new Map<string, number>(
  (pokedexData as { num: number; name_en: string }[]).map(p => [clean(p.name_en), p.num]),
);

// See the file-header comment for why this exists and how it was verified.
function resolveDexNum(cardName: string): number | null {
  let n = cardName.split(' & ')[0]; // tag-team cards: first-named Pokémon (matches lib/tcg.ts's useTagTeamCards)
  const possessive = n.match(/^.+?'s\s+(.+)$/);
  if (possessive) n = possessive[1];
  n = n.replace(/^(Alolan|Galarian|Hisuian|Paldean|Mega|Shining|Radiant|Dynamax|Gigantamax|White|Black|Origin Forme|Crowned)\s+/i, '');
  n = n.replace(/\s+(VMAX|VSTAR|V-UNION|GX|EX|ex|V|BREAK|Prime|LEGEND|Star|◇|δ|Delta Species)$/i, '');
  n = n.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (NAME_TO_DEX.has(clean(n))) return NAME_TO_DEX.get(clean(n))!;
  const lastWord = n.split(' ').pop()!; // multi-word forms: "Ice Rider Calyrex" / "Heat Rotom" — base species is the last word
  return NAME_TO_DEX.get(clean(lastWord)) ?? null;
}

const SUPERTYPE_LABEL: Record<PqCard['card_type'], string> = {
  pokemon: 'Pokémon',
  trainer: 'Trainer',
  supporter: 'Trainer', // Supporter is a Trainer subtype in the real TCG — no separate supertype bucket in our schema
  stadium: 'Trainer',
  energy: 'Energy',
};

function toRow(c: PqCard, set: PqSet) {
  if (!c.image_url) return null;
  return {
    id: `cn-${c.card_set_id}-${c.card_number}`,
    name: c.local_name,
    dex_num: c.card_type === 'pokemon' ? resolveDexNum(c.name) : null,
    set_id: `cn-${c.card_set_id}`,
    set_name: set.local_name,
    card_number: c.card_number,
    rarity: c.rarity_label,
    artist: null,
    image_small: c.image_url,
    image_large: c.image_url,
    release_date: set.release_date,
    series: 'Chine', // same coarse per-region bucket as the existing (Taiwan) cn-* rows — see 056_tcg_sets_series.sql
    cardmarket_trend_eur: null,
    cardmarket_avg_eur: null,
    cardmarket_low_eur: null,
    cardmarket_updated_at: null,
    region: 'cn',
    supertype: SUPERTYPE_LABEL[c.card_type],
    updated_at: new Date().toISOString(),
  };
}

const BATCH_SIZE = 200;

async function main() {
  console.log('Fetching set list...');
  const sets = await fetchAllPages<PqSet>('/v1/sets');
  const setById = new Map(sets.map(s => [s.id, s]));
  console.log(`${sets.length} sets found.`);

  console.log('Fetching full card catalog (paced to avoid the burst limiter, this takes a few minutes)...');
  const cards = await fetchAllPages<PqCard>('/v1/cards');
  console.log(`${cards.length} cards fetched.`);

  const rows = cards
    .map(c => {
      const set = setById.get(c.card_set_id);
      if (!set) { console.warn(`  card ${c.id}: unknown set ${c.card_set_id}, skipping`); return null; }
      return toRow(c, set);
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`Upserting ${rows.length} rows...`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('tcg_cards').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
    console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  const withDex = rows.filter(r => r.dex_num != null).length;
  console.log(`\nDone. ${rows.length} cards written, ${withDex} linked to a Pokédex entry.`);
}

main().catch(e => { console.error(e); process.exit(1); });
