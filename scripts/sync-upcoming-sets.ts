import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const { SUPABASE_URL, EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const url = SUPABASE_URL ?? EXPO_PUBLIC_SUPABASE_URL;
if (!url || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env vars — see .env.example');
}

const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// pokemontcg.io and TCGdex (our two card/set sources) only ever list a set once
// it has actually released — checked both their docs/API, neither has an
// "upcoming" concept — so announced-but-unreleased sets have no first-party
// source in this app. PokeGuardian's upcoming-sets page is the most reliably
// structured fan source found (2026-09 survey): a repeating
// name/date/info-link block immediately followed by an image block, grouped
// under "Japanese Sets"/"International Sets" <h2> headers. This is inherently
// fragile — a redesign of that page silently breaks the selectors below — and
// images/text are hotlinked from their site, not ours to redistribute, hence
// storing their URLs directly rather than downloading and re-hosting.
const SOURCE_URL = 'https://www.pokeguardian.com/sets/upcoming-sets';
const SOURCE_ORIGIN = 'https://www.pokeguardian.com';

interface ScrapedSet {
  sourceId: string;
  name: string;
  region: 'international' | 'jp';
  releaseDate: string | null; // YYYY-MM-DD
  releaseDateLabel: string;
  imageUrl: string | null;
  sourceUrl: string | null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// The <img>'s bare `src` is often a smaller "standard" rendition — srcset
// carries the same image at several widths via a `<url> <width>w` list, so
// pick the widest one for a banner-quality image when it's present.
function pickBestImageUrl($img: cheerio.Cheerio<any>): string | null {
  const srcset = $img.attr('srcset');
  if (srcset) {
    const candidates = srcset.split(',').map(entry => {
      const [imgUrl, widthTok] = entry.trim().split(/\s+/);
      return { imgUrl, width: parseInt(widthTok, 10) || 0 };
    });
    const widest = candidates.reduce((a, b) => (b.width > a.width ? b : a), candidates[0]);
    if (widest?.imgUrl) return widest.imgUrl;
  }
  return $img.attr('src') ?? null;
}

function parseReleaseDate(label: string): string | null {
  const d = new Date(label);
  if (isNaN(d.getTime())) return null;
  // Build the YYYY-MM-DD string from local getters, not toISOString() — the
  // label has no timezone info, so `new Date(label)` parses it as local
  // midnight; toISOString() would then convert to UTC and silently shift the
  // date back a day on any machine/runner west of UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function scrape(): Promise<ScrapedSet[]> {
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokedexnationalBot/1.0)' },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${SOURCE_URL}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const results: ScrapedSet[] = [];
  let region: 'international' | 'jp' = 'international';

  $('.jw-element').each((_, el) => {
    const $el = $(el);

    if ($el.hasClass('jw-image-text')) {
      const h2 = $el.find('h2.jw-heading-100').first().text().trim();
      if (h2 === 'Japanese Sets') region = 'jp';
      else if (h2 === 'International Sets') region = 'international';

      // A real set entry has exactly this shape: a bold name, a plain-text
      // date, and an "Info" link — the intro paragraph and section headers
      // above don't have all three, so they fall through harmlessly.
      const heading3s = $el.find('h3.jw-heading-70');
      if (heading3s.length < 3) return;

      const name = $el.find('h3.jw-heading-70 strong').first().text().trim();
      const dateLabel = $(heading3s.get(1)).text().trim();
      const infoLink = $el.find('h3.jw-heading-70 a[data-jwlink-identifier]').first();
      const sourceId = infoLink.attr('data-jwlink-identifier') ?? `${region}:${slugify(name)}`;
      const href = infoLink.attr('href');
      if (!name || !dateLabel) return;

      // The image lives in the *next* sibling .jw-element (a .jw-image block),
      // not inside this one — grab it now while we're positioned here.
      const $img = $el.next('.jw-element.jw-image').find('img').first();
      const imageUrl = $img.length ? pickBestImageUrl($img) : null;

      results.push({
        sourceId,
        name,
        region,
        releaseDate: parseReleaseDate(dateLabel),
        releaseDateLabel: dateLabel,
        imageUrl,
        sourceUrl: href ? new URL(href, SOURCE_ORIGIN).toString() : null,
      });
    }
  });

  return results;
}

async function main() {
  const sets = await scrape();
  // A page that's still there but returned nothing almost certainly means the
  // markup changed under us — bail loudly instead of silently truncating an
  // otherwise-populated table (same "red CI run beats a silent gap" reasoning
  // as the other sync scripts in this repo).
  if (sets.length === 0) {
    throw new Error('Scraped 0 upcoming sets — PokeGuardian likely changed its page markup, selectors need updating.');
  }

  console.log(`Scraped ${sets.length} upcoming sets:`);
  for (const s of sets) console.log(`  [${s.region}] ${s.name} — ${s.releaseDateLabel} (${s.releaseDate ?? 'unparsed date'})`);

  const { error: upsertError } = await supabase.from('upcoming_sets').upsert(
    sets.map(s => ({
      source_id: s.sourceId,
      name: s.name,
      region: s.region,
      release_date: s.releaseDate,
      release_date_label: s.releaseDateLabel,
      image_url: s.imageUrl,
      source_url: s.sourceUrl,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: 'source_id' },
  );
  if (upsertError) throw upsertError;

  // Only prune rows that both (a) weren't seen in this scrape and (b) already
  // released — a set genuinely still upcoming but missed by a partial-parse
  // regression stays in the table (stale-but-present) rather than vanishing.
  const seenIds = sets.map(s => s.sourceId);
  const today = new Date().toISOString().slice(0, 10);
  const { error: deleteError, count } = await supabase
    .from('upcoming_sets')
    .delete({ count: 'exact' })
    .not('source_id', 'in', `(${seenIds.map(id => `"${id}"`).join(',')})`)
    .lt('release_date', today);
  if (deleteError) throw deleteError;

  console.log(`Done. upserted=${sets.length} pruned=${count ?? 0}`);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
