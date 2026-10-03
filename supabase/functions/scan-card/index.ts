// Supabase Edge Function — receives a photo of a physical TCG card, runs it
// through Google Cloud Vision OCR, and matches the detected text against
// tcg_cards to return a short list of candidate cards for the client to
// confirm. Keeps GOOGLE_VISION_API_KEY server-side (set as a function secret
// via the Supabase Dashboard, never in the app's own .env/bundle) — the only
// reason this needs its own backend piece at all, everything else in this
// project talks to Supabase directly.
//
// Deploy via the Supabase Dashboard's Edge Functions code editor (no CLI on
// this machine, same manual-deploy pattern already used for migrations) —
// paste this file's contents there, then set the GOOGLE_VISION_API_KEY
// secret in the same dashboard section. SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// are injected automatically into every Edge Function, nothing to set for those.
import { createClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!GOOGLE_VISION_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing GOOGLE_VISION_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Callable from the app's own web (browser) and native clients alike — no
// stable single origin to lock this down to, same public-read posture as
// tcg_cards itself already has.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CardCandidate {
  id: string;
  name: string;
  dex_num: number | null;
  image_small: string;
  image_large: string | null;
  set_id: string;
  set_name: string;
  region: string;
  card_number: string;
  rarity: string | null;
}

// The printed "NNN/MMM" fraction (card number / set total) is the strongest
// identifying signal on the whole card. Usually plain digits, but subset
// numbering (Trainer Gallery "TG11/TG30", promos "SV77", "XY46", "GG19",
// "RC24", "BW48"...) prefixes both sides with 1-3 letters — captured as-is
// on the numerator (rawNumber) since tcg_cards.card_number stores those
// prefixes too (e.g. "TG11"), only the denominator's digits matter (it's
// just used to narrow candidate sets by card_count).
function extractNumberFraction(text: string): { rawNumber: string; total: number } | null {
  const match = text.match(/([A-Za-z]{0,3}\s?\d{1,4})\s*\/\s*([A-Za-z]{0,3}\s?\d{1,4})/);
  if (!match) return null;
  const totalDigits = match[2].match(/\d+/)?.[0];
  if (!totalDigits) return null;
  return { rawNumber: match[1].replace(/\s+/g, ''), total: parseInt(totalDigits, 10) };
}

// tcg_cards.card_number is inconsistent not just on leading zeros (base1 "62"
// vs JP "005") but on letter prefixes/suffixes too ("TG11", "40a") — split
// into letters/digits/letters and rebuild so "tg011" and "TG11" compare equal
// without discarding the prefix (a plain parseInt on "TG11" is NaN, which is
// exactly how this used to silently drop every Trainer Gallery/promo card).
function normalizeCardNumber(raw: string): string {
  const m = raw.trim().match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  if (!m) return raw.toUpperCase();
  const [, prefix, digits, suffix] = m;
  return `${prefix.toUpperCase()}${parseInt(digits, 10)}${suffix.toUpperCase()}`;
}

// No bounding-box layout heuristic in this first pass (the name could be any
// line long enough to not be pure punctuation/numbers) — every candidate line
// gets tried as a name-similarity anchor via the search_cards_by_name RPC,
// not just an assumed "first line" or "biggest text" guess.
function extractNameCandidates(fullText: string): string[] {
  return fullText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length >= 2 && /[a-zA-Z぀-ヿ一-鿿]/.test(line));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return json({ error: 'Missing imageBase64' }, 400);
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION' }] }],
        }),
      },
    );
    if (!visionRes.ok) throw new Error(`Vision API ${visionRes.status}: ${await visionRes.text()}`);
    const visionData = await visionRes.json();
    const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? '';
    if (!fullText) return json({ candidates: [], reason: 'no_text_detected' });

    const fraction = extractNumberFraction(fullText);
    const nameCandidates = extractNameCandidates(fullText);
    const bestNameGuess = nameCandidates[0] ?? '';

    // TEMP DEBUG (2026-09) — remove once real-world OCR matching is validated.
    // Check this function's Logs tab in the Supabase dashboard after a scan.
    console.log('[scan-card] fullText:', JSON.stringify(fullText));
    console.log('[scan-card] fraction:', JSON.stringify(fraction));
    console.log('[scan-card] bestNameGuess:', JSON.stringify(bestNameGuess));

    let candidates: CardCandidate[] = [];

    if (fraction) {
      // Narrow by set size first (±2, for secret rares beyond the printed
      // total) — this alone usually gets down to just one or two sets,
      // before even looking at the card's own name.
      const { data: matchingSets } = await supabase
        .from('tcg_sets')
        .select('set_id')
        .gte('card_count', fraction.total - 2)
        .lte('card_count', fraction.total + 2);
      const setIds = (matchingSets ?? []).map((s: { set_id: string }) => s.set_id);

      if (setIds.length > 0) {
        const { data: numberMatches } = await supabase
          .from('tcg_cards')
          .select('id, name, dex_num, image_small, image_large, set_id, set_name, region, card_number, rarity')
          .in('set_id', setIds);

        const targetNumber = normalizeCardNumber(fraction.rawNumber);
        const numeric = (numberMatches ?? []).filter((c: { card_number: string }) =>
          normalizeCardNumber(c.card_number) === targetNumber,
        );

        if (numeric.length === 1) {
          candidates = numeric;
        } else if (numeric.length > 1 && bestNameGuess) {
          // More than one set shares this number+total combo (or the ±2
          // tolerance pulled in a neighbor) — the name breaks the tie.
          const { data: ranked } = await supabase.rpc('search_cards_by_name', {
            query_text: bestNameGuess,
            candidate_ids: numeric.map((c: { id: string }) => c.id),
            match_limit: 3,
          });
          candidates = ranked ?? numeric.slice(0, 3);
        } else {
          candidates = numeric.slice(0, 3);
        }
      }
    }

    // Fraction unreadable, or matched nothing — fall back to a name-only
    // search across the whole catalog. Lower confidence, but still better
    // than failing outright on a glare/angle that only obscured the number.
    if (candidates.length === 0 && bestNameGuess) {
      const { data: byName } = await supabase.rpc('search_cards_by_name', {
        query_text: bestNameGuess,
        match_limit: 3,
      });
      candidates = byName ?? [];
    }

    console.log('[scan-card] candidates:', candidates.map(c => `${c.id} (${c.card_number})`));

    return json({ candidates });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
