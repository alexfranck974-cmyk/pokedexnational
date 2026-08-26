import { applyWishlistPipeline, groupWishlistByPokemon, isPriceAlertTriggered, type WishlistCard } from '../lib/wishlist-list';
import type { PokemonType } from '../lib/types';

const cards: WishlistCard[] = [
  { id: 'base1-1', name: 'Bulbasaur', dex_num: 1, set_id: 'base1', set_name: 'Base', card_number: '44', rarity: 'Common', image_small: '', image_large: null, release_date: '1999-01-09', series: 'Base', wished_at: '2026-01-01' },
  { id: 'jungle-1', name: 'Bulbasaur', dex_num: 1, set_id: 'jungle', set_name: 'Jungle', card_number: '30', rarity: 'Rare Holo', image_small: '', image_large: null, release_date: '1999-06-16', series: 'Base', wished_at: '2026-02-01' },
  { id: 'base1-46', name: 'Charmander', dex_num: 4, set_id: 'base1', set_name: 'Base', card_number: '46', rarity: 'Common', image_small: '', image_large: null, release_date: '1999-01-09', series: 'Base', wished_at: '2026-03-01' },
  { id: 'base1-58', name: 'Pikachu', dex_num: 25, set_id: 'base1', set_name: 'Base', card_number: '58', rarity: 'Common', image_small: '', image_large: null, release_date: '1999-01-09', series: 'Base', wished_at: '2026-01-15' },
];

const typesByDex = new Map<number, PokemonType[]>([
  [1, ['grass', 'poison']],
  [4, ['fire']],
  [25, ['electric']],
]);

const noFilters = {
  search: '', statusFilter: 'all' as const, typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc' as const,
};

describe('applyWishlistPipeline', () => {
  it('filters by status=not_owned', () => {
    const owned = new Set(['base1-1']);
    const r = applyWishlistPipeline(cards, owned, typesByDex, { ...noFilters, statusFilter: 'not_owned' });
    expect(r.map(c => c.id)).toEqual(['jungle-1', 'base1-46', 'base1-58']);
  });

  it('filters by status=owned', () => {
    const owned = new Set(['base1-1']);
    const r = applyWishlistPipeline(cards, owned, typesByDex, { ...noFilters, statusFilter: 'owned' });
    expect(r.map(c => c.id)).toEqual(['base1-1']);
  });

  it('filters by type via the dex_num -> types lookup', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, typeFilter: 'fire' });
    expect(r.map(c => c.id)).toEqual(['base1-46']);
  });

  it('filters by set', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, setFilter: 'jungle' });
    expect(r.map(c => c.id)).toEqual(['jungle-1']);
  });

  it('filters by rarity', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, rarityFilter: 'Rare Holo' });
    expect(r.map(c => c.id)).toEqual(['jungle-1']);
  });

  it('filters by generation', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, generationFilter: 1 });
    expect(r.map(c => c.id).sort()).toEqual(['base1-1', 'base1-46', 'base1-58', 'jungle-1'].sort());
  });

  it('searches by name, accent/case-insensitive', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, search: 'pika' });
    expect(r.map(c => c.id)).toEqual(['base1-58']);
  });

  it('searches by set name', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, search: 'jungle' });
    expect(r.map(c => c.id)).toEqual(['jungle-1']);
  });

  it('searches by dex number, padded or not', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, search: '025' });
    expect(r.map(c => c.id)).toEqual(['base1-58']);
  });

  it('combines filters with AND logic', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, setFilter: 'base1', typeFilter: 'grass' });
    expect(r.map(c => c.id)).toEqual(['base1-1']);
  });

  it('sorts by dex number ascending/descending', () => {
    const asc = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, sort: 'num-asc' });
    expect(asc.map(c => c.dex_num)).toEqual([1, 1, 4, 25]);
    const desc = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, sort: 'num-desc' });
    expect(desc.map(c => c.dex_num)).toEqual([25, 4, 1, 1]);
  });

  it('sorts by name, accent-insensitive', () => {
    const r = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, sort: 'name-asc' });
    expect(r.map(c => c.name)).toEqual(['Bulbasaur', 'Bulbasaur', 'Charmander', 'Pikachu']);
  });

  it('sorts by wished_at, most/least recent first', () => {
    const desc = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, sort: 'wished-desc' });
    expect(desc.map(c => c.id)).toEqual(['base1-46', 'jungle-1', 'base1-58', 'base1-1']);
    const asc = applyWishlistPipeline(cards, new Set(), typesByDex, { ...noFilters, sort: 'wished-asc' });
    expect(asc.map(c => c.id)).toEqual(['base1-1', 'base1-58', 'jungle-1', 'base1-46']);
  });

  it('floats priority (coup de cœur) cards to the top regardless of sort, preserving order within each group', () => {
    const withPriority = cards.map(c => c.id === 'base1-58' ? { ...c, is_priority: true } : c);
    const r = applyWishlistPipeline(withPriority, new Set(), typesByDex, { ...noFilters, sort: 'num-asc' });
    expect(r.map(c => c.id)).toEqual(['base1-58', 'base1-1', 'jungle-1', 'base1-46']);
  });
});

describe('isPriceAlertTriggered', () => {
  const base: WishlistCard = cards[0];

  it('is false with no alert set', () => {
    expect(isPriceAlertTriggered({ ...base, price_alert_eur: null, cardmarket_trend_eur: 5 })).toBe(false);
  });

  it('is false when the current price is still above the target', () => {
    expect(isPriceAlertTriggered({ ...base, price_alert_eur: 10, cardmarket_trend_eur: 15 })).toBe(false);
  });

  it('is true once the current price drops to or below the target', () => {
    expect(isPriceAlertTriggered({ ...base, price_alert_eur: 10, cardmarket_trend_eur: 10 })).toBe(true);
    expect(isPriceAlertTriggered({ ...base, price_alert_eur: 10, cardmarket_trend_eur: 8 })).toBe(true);
  });

  it('is false when the current price is unknown', () => {
    expect(isPriceAlertTriggered({ ...base, price_alert_eur: 10, cardmarket_trend_eur: null })).toBe(false);
  });
});

describe('groupWishlistByPokemon', () => {
  it('groups cards by dex_num, preserving first-appearance order', () => {
    const groups = groupWishlistByPokemon(cards);
    expect(groups.map(g => g.dexNum)).toEqual([1, 4, 25]);
    expect(groups[0].cards.map(c => c.id)).toEqual(['base1-1', 'jungle-1']);
  });

  it('surfaces owned cards first within a group when ownedIds is given', () => {
    const owned = new Set(['jungle-1']);
    const groups = groupWishlistByPokemon(cards, owned);
    const bulbasaurGroup = groups.find(g => g.dexNum === 1)!;
    expect(bulbasaurGroup.cards.map(c => c.id)).toEqual(['jungle-1', 'base1-1']);
  });

  it('keeps original order when no card in a group is owned', () => {
    const groups = groupWishlistByPokemon(cards, new Set());
    const bulbasaurGroup = groups.find(g => g.dexNum === 1)!;
    expect(bulbasaurGroup.cards.map(c => c.id)).toEqual(['base1-1', 'jungle-1']);
  });
});
