// Search-only supplement to data/pokedex.json (name_fr/name_en only) — pulls
// every other language PokeAPI has a species name for (de, es, it, ja-Hrkt,
// ja, ko, zh-Hant, zh-Hans, ...) so "chercher un Pokémon, qu'importe la
// langue de son nom" works for German/Spanish/etc too, not just the app's
// own two display locales. Deliberately a separate lightweight file/script
// rather than extending build-pokemon-data.ts's schema: that script re-fetches
// stats/sprites/flavor-text for all 1025 species (two endpoints each, ~3-4min
// run) — this only needs the `names` array off the species endpoint, one
// call per species, and isn't part of the Pokemon type other screens rely on.
// Only re-run if the 1025 changes (same condition as build:pokedex).
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.resolve(__dirname, '../data/pokemon-name-aliases.json');
const RATE_LIMIT_MS = 100;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface SpeciesResponse {
  names: { name: string; language: { name: string } }[];
}

async function main() {
  const result: Record<number, string[]> = {};
  for (let num = 1; num <= 1025; num++) {
    const species = await fetchJson<SpeciesResponse>(`https://pokeapi.co/api/v2/pokemon-species/${num}`);
    // fr/en are already covered by pokedex.json's own fields — keep this file
    // to just the extra languages, deduped (a few names repeat across locales).
    const extra = Array.from(new Set(
      species.names.filter(n => n.language.name !== 'fr' && n.language.name !== 'en').map(n => n.name),
    ));
    if (extra.length > 0) result[num] = extra;
    if (num % 100 === 0) console.log(`Fetched ${num}/1025`);
    await sleep(RATE_LIMIT_MS);
  }
  fs.writeFileSync(OUT, JSON.stringify(result));
  console.log(`Wrote aliases for ${Object.keys(result).length} entries to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
