import type { Pokemon, PokemonType } from './types';
import { getName } from './i18n';

export type StatusFilter = 'all' | 'owned' | 'missing';
export type SortKey = 'num-asc' | 'num-desc' | 'name-asc' | 'name-desc';

export interface PipelineOptions {
  search: string;
  statusFilter: StatusFilter;
  typeFilter: PokemonType | null;
  setFilter: string | null;
  rarityFilter: string | null;
  sort: SortKey;
}

export interface PokemonWithState extends Pokemon { owned: boolean }

export type TcgIndex = Map<number, { set_ids: string[]; rarities: string[] }>;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function applyPokedexPipeline(
  pokemons: Pokemon[],
  owned: Set<number>,
  tcgIndex: TcgIndex,
  opts: PipelineOptions,
): PokemonWithState[] {
  const searchN = normalize(opts.search.trim());
  const searchDigits = /^\d+$/.test(searchN) ? String(parseInt(searchN, 10)) : null;

  const merged: PokemonWithState[] = pokemons.map(p => ({ ...p, owned: owned.has(p.num) }));

  const filtered = merged.filter(p => {
    if (opts.statusFilter === 'owned' && !p.owned) return false;
    if (opts.statusFilter === 'missing' && p.owned) return false;

    if (opts.typeFilter && !p.types.includes(opts.typeFilter)) return false;

    if (opts.setFilter) {
      const idx = tcgIndex.get(p.num);
      if (!idx || !idx.set_ids.includes(opts.setFilter)) return false;
    }
    if (opts.rarityFilter) {
      const idx = tcgIndex.get(p.num);
      if (!idx || !idx.rarities.includes(opts.rarityFilter)) return false;
    }

    if (searchN) {
      if (searchDigits && String(p.num) === searchDigits) return true;
      const paddedMatch = String(p.num).padStart(3, '0').includes(searchN);
      if (paddedMatch) return true;
      const nameMatches =
        (p.name_fr && normalize(p.name_fr).includes(searchN)) ||
        normalize(p.name_en).includes(searchN);
      if (!nameMatches) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  const cmpName = (a: PokemonWithState, b: PokemonWithState) =>
    normalize(getName(a)).localeCompare(normalize(getName(b)));
  switch (opts.sort) {
    case 'num-asc':  sorted.sort((a, b) => a.num - b.num); break;
    case 'num-desc': sorted.sort((a, b) => b.num - a.num); break;
    case 'name-asc':  sorted.sort(cmpName); break;
    case 'name-desc': sorted.sort((a, b) => cmpName(b, a)); break;
  }
  return sorted;
}
