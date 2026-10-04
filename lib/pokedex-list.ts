import type { Pokemon, PokemonType } from './types';
import { getName } from './i18n';
import { GENERATIONS } from './generations';
import type { Locale } from './locale';
import nameAliasesData from '@/data/pokemon-name-aliases.json';

// Every non-fr/non-en PokeAPI species name (de, es, it, ja-Hrkt, ko, ...) —
// name_fr/name_en already cover the app's own two display locales directly
// on the Pokemon object, this is purely a search-matching supplement so
// "chercher un Pokémon, qu'importe la langue de son nom" isn't limited to
// those two (see scripts/build-name-aliases.ts for why this is a separate
// file instead of a new field on Pokemon itself).
const NAME_ALIASES_BY_NUM = new Map<number, string[]>(
  Object.entries(nameAliasesData as Record<string, string[]>).map(([num, names]) => [Number(num), names]),
);

export type StatusFilter = 'all' | 'owned' | 'missing';
export type SortKey = 'num-asc' | 'num-desc' | 'name-asc' | 'name-desc';

export interface PipelineOptions {
  search: string;
  statusFilter: StatusFilter;
  typeFilter: PokemonType[];
  setFilter: string | null;
  rarityFilter: string | null;
  generationFilter?: number[];
  sort: SortKey;
}

export interface PokemonWithState extends Pokemon { owned: boolean; collected: boolean }

export type TcgIndex = Map<number, { set_ids: string[]; rarities: string[] }>;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Shared between the filter pipeline below and the national Pokédex's
// "locate" search (app/(app)/(tabs)/pokedex.tsx — jumps to + highlights a
// unique match in the full grid instead of filtering everything else out),
// so both agree on what counts as a match.
export function pokemonMatchesSearch(p: Pokemon, rawSearch: string): boolean {
  const searchN = normalize(rawSearch.trim());
  if (!searchN) return true;
  const searchDigits = /^\d+$/.test(searchN) ? String(parseInt(searchN, 10)) : null;
  if (searchDigits && String(p.num) === searchDigits) return true;
  if (String(p.num).padStart(3, '0').includes(searchN)) return true;
  return (
    (!!p.name_fr && normalize(p.name_fr).includes(searchN)) ||
    normalize(p.name_en).includes(searchN) ||
    (NAME_ALIASES_BY_NUM.get(p.num) ?? []).some(alias => normalize(alias).includes(searchN))
  );
}

// Stricter than pokemonMatchesSearch above on purpose — used only to decide
// whether the national Pokédex's "locate" search has converged on a single
// Pokémon yet (pokedex.tsx's locateNum). A plain substring match against
// every alias across ~10 languages collides constantly on short prefixes
// (e.g. "char" alone matches 14+ Pokémon — Medicham/Torkoal/Rampardos/... all
// happen to contain "char" somewhere in some language's name), which kept
// "locate" from kicking in until almost the whole name was typed. Prefix
// matching converges immediately ("pika" → Pikachu uniquely after 4 letters)
// since it's anchored to how an actual name starts, not an arbitrary substring.
export function pokemonLocateMatch(p: Pokemon, rawSearch: string): boolean {
  const searchN = normalize(rawSearch.trim());
  if (!searchN) return false;
  const searchDigits = /^\d+$/.test(searchN) ? String(parseInt(searchN, 10)) : null;
  if (searchDigits && String(p.num) === searchDigits) return true;
  return (
    (!!p.name_fr && normalize(p.name_fr).startsWith(searchN)) ||
    normalize(p.name_en).startsWith(searchN) ||
    (NAME_ALIASES_BY_NUM.get(p.num) ?? []).some(alias => normalize(alias).startsWith(searchN))
  );
}

export function applyPokedexPipeline(
  pokemons: Pokemon[],
  owned: Set<number>,
  tcgIndex: TcgIndex,
  opts: PipelineOptions,
  collectedDex: Set<number> = owned,
  locale: Locale = 'fr',
): PokemonWithState[] {
  const searchN = normalize(opts.search.trim());

  const merged: PokemonWithState[] = pokemons.map(p => ({
    ...p, owned: owned.has(p.num), collected: collectedDex.has(p.num),
  }));

  const filtered = merged.filter(p => {
    if (opts.statusFilter === 'owned' && !p.owned) return false;
    if (opts.statusFilter === 'missing' && p.owned) return false;

    if (opts.typeFilter.length > 0 && !opts.typeFilter.some(t => p.types.includes(t))) return false;

    if (opts.setFilter) {
      const idx = tcgIndex.get(p.num);
      if (!idx || !idx.set_ids.includes(opts.setFilter)) return false;
    }
    if (opts.rarityFilter) {
      const idx = tcgIndex.get(p.num);
      if (!idx || !idx.rarities.includes(opts.rarityFilter)) return false;
    }

    if (opts.generationFilter && opts.generationFilter.length > 0) {
      const matches = opts.generationFilter.some(gen => {
        const g = GENERATIONS.find(x => x.gen === gen);
        return g && p.num >= g.min && p.num <= g.max;
      });
      if (!matches) return false;
    }

    if (searchN && !pokemonMatchesSearch(p, opts.search)) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered];
  const cmpName = (a: PokemonWithState, b: PokemonWithState) =>
    normalize(getName(a, locale)).localeCompare(normalize(getName(b, locale)));
  switch (opts.sort) {
    case 'num-asc':  sorted.sort((a, b) => a.num - b.num); break;
    case 'num-desc': sorted.sort((a, b) => b.num - a.num); break;
    case 'name-asc':  sorted.sort(cmpName); break;
    case 'name-desc': sorted.sort((a, b) => cmpName(b, a)); break;
  }
  return sorted;
}
