import * as fs from 'fs';
import * as path from 'path';
import type { Pokemon, PokemonType } from '../lib/types';

const OUT = path.resolve(__dirname, '../data/pokedex.json');
const RATE_LIMIT_MS = 100;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface SpeciesResponse {
  name: string;
  names: { name: string; language: { name: string } }[];
  evolves_from_species: { name: string } | null;
  flavor_text_entries: { flavor_text: string; language: { name: string }; version: { name: string } }[];
}
interface PokemonResponse {
  types: { type: { name: PokemonType } }[];
  sprites: { other?: { 'official-artwork'?: { front_default: string | null } } };
  stats: { base_stat: number; stat: { name: string } }[];
}

interface BuildRow extends Pokemon {
  speciesName: string;
  evolvesFromName: string | null;
}

// PokéAPI lists flavor text entries in roughly game-release order (verified
// against Bulbasaur's list: 'red' first, 'shield' last) — the last entry for
// a language is the most recent game to describe it, which also sidesteps
// old Game Boy-era text's `\f` page breaks and "POKéMON" caps.
function latestFlavorText(entries: SpeciesResponse['flavor_text_entries'], lang: string): string | null {
  const matches = entries.filter(e => e.language.name === lang);
  if (matches.length === 0) return null;
  return matches[matches.length - 1].flavor_text.replace(/[\n\f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function statsFromResponse(pokemon: PokemonResponse): Pokemon['stats'] {
  const byName = new Map(pokemon.stats.map(s => [s.stat.name, s.base_stat]));
  return {
    hp: byName.get('hp') ?? 0,
    attack: byName.get('attack') ?? 0,
    defense: byName.get('defense') ?? 0,
    specialAttack: byName.get('special-attack') ?? 0,
    specialDefense: byName.get('special-defense') ?? 0,
    speed: byName.get('speed') ?? 0,
  };
}

async function buildOne(num: number): Promise<BuildRow> {
  const species = await fetchJson<SpeciesResponse>(
    `https://pokeapi.co/api/v2/pokemon-species/${num}`,
  );
  const pokemon = await fetchJson<PokemonResponse>(
    `https://pokeapi.co/api/v2/pokemon/${num}`,
  );
  const nameFr = species.names.find(n => n.language.name === 'fr')?.name ?? null;
  const nameEn = species.names.find(n => n.language.name === 'en')?.name ?? `#${num}`;
  const types = pokemon.types.map(t => t.type.name);
  const sprite =
    pokemon.sprites.other?.['official-artwork']?.front_default ??
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`;
  return {
    num, name_fr: nameFr, name_en: nameEn, types, sprite_url: sprite,
    evolvesFromNum: null,
    evolvesToNums: [],
    stats: statsFromResponse(pokemon),
    description_fr: latestFlavorText(species.flavor_text_entries, 'fr'),
    description_en: latestFlavorText(species.flavor_text_entries, 'en'),
    speciesName: species.name,
    evolvesFromName: species.evolves_from_species?.name ?? null,
  };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const all: BuildRow[] = [];
  for (let num = 1; num <= 1025; num++) {
    try {
      const p = await buildOne(num);
      all.push(p);
      if (num % 50 === 0) console.log(`Fetched ${num}/1025`);
    } catch (err) {
      console.error(`Failed at ${num}:`, err);
      throw err;
    }
    await sleep(RATE_LIMIT_MS);
  }

  // Second pass: resolve evolvesFromName -> evolvesFromNum. Two-pass because some
  // pre-evolutions have a *higher* dex number than their evolution (e.g. Pichu #172
  // was added after Pikachu #25), so this can't be resolved during the initial loop.
  const numBySpeciesName = new Map(all.map(p => [p.speciesName, p.num]));
  const withEvolvesFrom = all.map(({ speciesName, evolvesFromName, ...rest }) => ({
    ...rest,
    evolvesFromNum: evolvesFromName ? numBySpeciesName.get(evolvesFromName) ?? null : null,
  }));

  // evolvesToNums is just the reverse of evolvesFromNum — no extra API calls
  // needed, and branching families (e.g. Eevee -> multiple Eeveelutions) fall
  // out naturally since several entries can point evolvesFromNum at the same num.
  const evolvesToByNum = new Map<number, number[]>();
  for (const p of withEvolvesFrom) {
    if (p.evolvesFromNum == null) continue;
    const list = evolvesToByNum.get(p.evolvesFromNum) ?? [];
    list.push(p.num);
    evolvesToByNum.set(p.evolvesFromNum, list);
  }
  const result: Pokemon[] = withEvolvesFrom.map(p => ({
    ...p,
    evolvesToNums: evolvesToByNum.get(p.num) ?? [],
  }));

  fs.writeFileSync(OUT, JSON.stringify(result));
  console.log(`Wrote ${result.length} entries to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
