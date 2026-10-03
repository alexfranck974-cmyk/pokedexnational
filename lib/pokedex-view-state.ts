import type { StatusFilter, SortKey } from './pokedex-list';
import type { PokemonType } from './types';

export interface PokedexViewState {
  search: string;
  statusFilter: StatusFilter;
  typeFilter: PokemonType[];
  setFilter: string | null;
  rarityFilter: string | null;
  generationFilter: number[];
  sort: SortKey;
  columns: 2 | 3 | 4 | null;
  scrollOffset: number;
}

const DEFAULT_STATE: PokedexViewState = {
  search: '', statusFilter: 'all', typeFilter: [], setFilter: null, rarityFilter: null,
  generationFilter: [], sort: 'num-asc', columns: null, scrollOffset: 0,
};

// Module-scoped (not persisted to storage, not React state) — survives a
// remount of app/(app)/(tabs)/pokedex.tsx within the same app session. Going
// to a Pokémon's detail screen and back uses useBackTo's router.replace
// (lib/navigation.ts's from-param system, shared by many other screens and
// deliberately left alone, see memory), which re-navigates to '/pokedex'
// rather than popping back to the already-mounted screen — losing every
// local useState (search/filters/sort/columns/scroll) in the process. Rather
// than touching that shared navigation system, pokedex.tsx reads its initial
// state from here instead of hardcoded defaults, and writes back on every
// change — the new instance picks up exactly where the old one left off.
let state: PokedexViewState = { ...DEFAULT_STATE };

export function getPokedexViewState(): PokedexViewState {
  return state;
}

export function setPokedexViewState(patch: Partial<PokedexViewState>) {
  state = { ...state, ...patch };
}
