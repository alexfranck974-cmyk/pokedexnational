import type { Pokemon, PokemonType } from './types';
import { GENERATIONS, getGeneration } from './generations';
import type { OwnedCardDetail } from './collection';
import type { SetGoal } from './collection-goals';
import type { TcgSetInfo } from './tcg-index';

export interface Progress { owned: number; total: number; pct: number; }

function toProgress(owned: number, total: number): Progress {
  return { owned, total, pct: total > 0 ? Math.round((owned / total) * 100) : 0 };
}

export function computeOverallProgress(pokedex: Pokemon[], owned: Set<number>): Progress {
  return toProgress(pokedex.filter(p => owned.has(p.num)).length, pokedex.length);
}

export interface GenerationProgress extends Progress { gen: number; label: string; }

export function computeByGeneration(pokedex: Pokemon[], owned: Set<number>): GenerationProgress[] {
  return GENERATIONS.map(g => {
    const mons = pokedex.filter(p => getGeneration(p.num) === g.gen);
    const ownedCount = mons.filter(p => owned.has(p.num)).length;
    return { gen: g.gen, label: g.label, ...toProgress(ownedCount, mons.length) };
  });
}

export interface TypeProgress extends Progress { type: PokemonType; }

export function computeByType(pokedex: Pokemon[], owned: Set<number>): TypeProgress[] {
  const byType = new Map<PokemonType, { owned: number; total: number }>();
  for (const p of pokedex) {
    for (const t of p.types) {
      const entry = byType.get(t) ?? { owned: 0, total: 0 };
      entry.total += 1;
      if (owned.has(p.num)) entry.owned += 1;
      byType.set(t, entry);
    }
  }
  return Array.from(byType.entries())
    .map(([type, { owned: o, total }]) => ({ type, ...toProgress(o, total) }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export interface VariantCard { id: string; name: string; dex_num: number; imageSmall: string; imageLarge: string | null; }

export type VariantCategory = 'mega' | 'alolan' | 'galarian' | 'hisuian' | 'paldean';

const isMega = (name: string) => /^Mega\s/i.test(name) || /^M\s.+-EX$/i.test(name);

export function bucketVariantCards(cards: VariantCard[]): Record<VariantCategory, VariantCard[]> {
  const buckets: Record<VariantCategory, VariantCard[]> = {
    mega: [], alolan: [], galarian: [], hisuian: [], paldean: [],
  };
  for (const card of cards) {
    if (isMega(card.name)) buckets.mega.push(card);
    if (/Alolan/i.test(card.name)) buckets.alolan.push(card);
    if (/Galarian/i.test(card.name)) buckets.galarian.push(card);
    if (/Hisuian/i.test(card.name)) buckets.hisuian.push(card);
    if (/Paldean/i.test(card.name)) buckets.paldean.push(card);
  }
  return buckets;
}

export function computeVariantProgress(
  buckets: Record<VariantCategory, VariantCard[]>,
  ownedCardIds: Set<string>,
): Record<VariantCategory, Progress> {
  const result = {} as Record<VariantCategory, Progress>;
  for (const category of Object.keys(buckets) as VariantCategory[]) {
    const cards = buckets[category];
    const ownedCount = cards.filter(c => ownedCardIds.has(c.id)).length;
    result[category] = toProgress(ownedCount, cards.length);
  }
  return result;
}

export function totalCollectionValue(ownedCards: OwnedCardDetail[]): number {
  return ownedCards.reduce((sum, c) => sum + (c.cardmarketTrendEur ?? 0), 0);
}

export interface SetGoalProgress extends Progress { setId: string; setName: string; symbol: string | null; }

// Owned counts come from ledgerCards (already fetched dashboard-wide) rather than a
// per-set query, so pinning/unpinning goals never triggers extra network requests.
export function computeSetGoalsProgress(
  pinnedGoals: SetGoal[],
  ledgerCards: { setId: string }[],
  allSets: TcgSetInfo[],
): SetGoalProgress[] {
  const ownedCountBySet = new Map<string, number>();
  for (const c of ledgerCards) {
    ownedCountBySet.set(c.setId, (ownedCountBySet.get(c.setId) ?? 0) + 1);
  }
  const setsById = new Map(allSets.map(s => [s.id, s]));
  return pinnedGoals
    .map(g => {
      const set = setsById.get(g.setId);
      if (!set) return null;
      return {
        setId: g.setId, setName: set.name, symbol: set.symbol,
        ...toProgress(ownedCountBySet.get(g.setId) ?? 0, set.cardCount),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

export function averageProgress(items: Progress[]): number {
  const withTotal = items.filter(i => i.total > 0);
  if (withTotal.length === 0) return 0;
  return Math.round(withTotal.reduce((sum, i) => sum + i.pct, 0) / withTotal.length);
}

export interface ArtistCount { artist: string; count: number; }

// Deliberately not a Progress/X-out-of-Y ring: there's no meaningful "total" per artist
// under the one-card-per-Pokémon model, just a ranked count of owned cards.
export function topArtists(ownedCards: OwnedCardDetail[], limit: number): ArtistCount[] {
  const counts = new Map<string, number>();
  for (const c of ownedCards) {
    if (!c.artist) continue;
    counts.set(c.artist, (counts.get(c.artist) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([artist, count]) => ({ artist, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
