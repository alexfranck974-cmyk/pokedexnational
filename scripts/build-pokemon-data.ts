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
  names: { name: string; language: { name: string } }[];
}
interface PokemonResponse {
  types: { type: { name: PokemonType } }[];
  sprites: { other?: { 'official-artwork'?: { front_default: string | null } } };
}

async function buildOne(num: number): Promise<Pokemon> {
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
  return { num, name_fr: nameFr, name_en: nameEn, types, sprite_url: sprite };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const all: Pokemon[] = [];
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
  fs.writeFileSync(OUT, JSON.stringify(all));
  console.log(`Wrote ${all.length} entries to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
