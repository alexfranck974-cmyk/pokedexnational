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

// Lightweight companion to sync-tcgdex-cards.ts, same relationship
// sync-tcg-prices.ts has to sync-tcg-cards.ts: JP/CN card metadata barely
// changes once a set is released, but prices move constantly. The full
// sync (sync-tcgdex-cards.ts) only runs monthly (see
// .github/workflows/sync-tcgdex-cards.yml) — confirmed 2026-08-19 that this
// left JP/CN prices up to a month stale with zero staleness indicator (unlike
// global cards, which get a weekly price-only refresh via sync-tcg-prices.ts).
// This iterates the jp-/cn- rows we already have (no series/set crawl needed —
// unlike the full sync, we're not discovering new cards here) and only
// touches the four cardmarket_* columns.
const LOCALE_BY_REGION: Record<'jp' | 'cn', string> = { jp: 'ja', cn: 'zh-cn' };
const CONCURRENCY = 5;
const MAX_RETRIES = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
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

interface CardPricing {
  pricing?: { cardmarket?: { trend?: number | null; avg?: number | null; low?: number | null; updated?: string | null } | null };
}

interface DbRow { id: string; region: 'jp' | 'cn'; }

async function fetchAllRows(): Promise<DbRow[]> {
  const rows: DbRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tcg_cards')
      .select('id, region')
      .in('region', ['jp', 'cn'])
      .range(from, from + 999)
      .returns<DbRow[]>();
    if (error) throw error;
    if (!data.length) break;
    rows.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const rows = await fetchAllRows();
  console.log(`${rows.length} JP/CN cards to refresh.`);

  let updated = 0;
  let unchanged = 0;
  await mapLimit(rows, CONCURRENCY, async (row) => {
    // Our id is `${region}-${tcgdexNativeId}` (see toRow() in sync-tcgdex-cards.ts).
    const nativeId = row.id.slice(row.region.length + 1);
    const locale = LOCALE_BY_REGION[row.region];
    const card = await fetchJson<CardPricing>(`https://api.tcgdex.net/v2/${locale}/cards/${nativeId}`);
    const cardmarket = card.pricing?.cardmarket;
    if (!cardmarket) { unchanged++; return null; }

    const { error } = await supabase
      .from('tcg_cards')
      .update({
        cardmarket_trend_eur: cardmarket.trend ?? null,
        cardmarket_avg_eur: cardmarket.avg ?? null,
        cardmarket_low_eur: cardmarket.low ?? null,
        cardmarket_updated_at: cardmarket.updated ? new Date(cardmarket.updated).toISOString() : null,
      })
      .eq('id', row.id);
    if (error) { console.error(`${row.id} update failed:`, error.message); return null; }
    updated++;
    return null;
  });

  console.log(`Done. Updated ${updated}/${rows.length} (${unchanged} had no cardmarket data upstream).`);
}

main().catch(e => { console.error(e); process.exit(1); });
