import type { PokemonType } from './types';
import { GENERATIONS } from './generations';

export interface WishlistCard {
  id: string;
  name: string;
  dex_num: number;
  set_id: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  image_small: string;
  image_large: string | null;
  release_date: string | null;
  series: string | null;
  wished_at?: string;
}

export type WishStatusFilter = 'all' | 'not_owned' | 'owned';
export type WishSortKey = 'wished-desc' | 'wished-asc' | 'name-asc' | 'name-desc' | 'num-asc' | 'num-desc';

export interface WishlistPipelineOpts {
  search: string;
  statusFilter: WishStatusFilter;
  typeFilter: PokemonType | null;
  setFilter: string | null;
  rarityFilter: string | null;
  generationFilter?: number | null;
  sort: WishSortKey;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function applyWishlistPipeline(
  cards: WishlistCard[],
  ownedIds: Set<string>,
  typesByDex: Map<number, PokemonType[]>,
  opts: WishlistPipelineOpts,
): WishlistCard[] {
  const searchN = normalize(opts.search.trim());
  const filtered = cards.filter(c => {
    const owned = ownedIds.has(c.id);
    if (opts.statusFilter === 'not_owned' && owned) return false;
    if (opts.statusFilter === 'owned' && !owned) return false;
    if (opts.typeFilter) {
      const types = typesByDex.get(c.dex_num) ?? [];
      if (!types.includes(opts.typeFilter)) return false;
    }
    if (opts.setFilter && c.set_id !== opts.setFilter) return false;
    if (opts.rarityFilter && c.rarity !== opts.rarityFilter) return false;
    if (opts.generationFilter) {
      const g = GENERATIONS.find(x => x.gen === opts.generationFilter);
      if (!g || c.dex_num < g.min || c.dex_num > g.max) return false;
    }
    if (searchN) {
      const nameMatch = normalize(c.name).includes(searchN);
      const setMatch = normalize(c.set_name).includes(searchN);
      const dex = String(c.dex_num);
      const dexMatch = dex.includes(searchN) || String(c.dex_num).padStart(3, '0').includes(searchN);
      if (!nameMatch && !setMatch && !dexMatch) return false;
    }
    return true;
  });
  const sorted = [...filtered];
  const cmpName = (a: WishlistCard, b: WishlistCard) => normalize(a.name).localeCompare(normalize(b.name));
  switch (opts.sort) {
    case 'wished-desc': sorted.sort((a, b) => (b.wished_at ?? '').localeCompare(a.wished_at ?? '')); break;
    case 'wished-asc':  sorted.sort((a, b) => (a.wished_at ?? '').localeCompare(b.wished_at ?? '')); break;
    case 'name-asc':  sorted.sort(cmpName); break;
    case 'name-desc': sorted.sort((a, b) => cmpName(b, a)); break;
    case 'num-asc':  sorted.sort((a, b) => a.dex_num - b.dex_num); break;
    case 'num-desc': sorted.sort((a, b) => b.dex_num - a.dex_num); break;
  }
  return sorted;
}

export interface WishlistGroup {
  dexNum: number;
  cards: WishlistCard[];
}

// Preserves the order cards first appear in (i.e. whatever sort was already applied),
// so switching to the grouped view keeps the same overall ordering, just clustered by Pokémon.
// Within each group, owned cards are surfaced first when ownedIds is given, so a partially
// completed Pokémon shows what's already in hand before what's still missing.
export function groupWishlistByPokemon(cards: WishlistCard[], ownedIds?: Set<string>): WishlistGroup[] {
  const order: number[] = [];
  const byDex = new Map<number, WishlistCard[]>();
  for (const c of cards) {
    if (!byDex.has(c.dex_num)) {
      byDex.set(c.dex_num, []);
      order.push(c.dex_num);
    }
    byDex.get(c.dex_num)!.push(c);
  }
  return order.map(dexNum => {
    const groupCards = byDex.get(dexNum)!;
    if (ownedIds) groupCards.sort((a, b) => Number(ownedIds.has(b.id)) - Number(ownedIds.has(a.id)));
    return { dexNum, cards: groupCards };
  });
}
