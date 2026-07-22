import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { GENERATIONS } from './generations';
import type { GenerationProgress, Progress, VariantCategory } from './dashboard-stats';
import { topArtists } from './dashboard-stats';
import type { OwnedCardDetail } from './collection';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface DashboardStats {
  overall: Progress;
  byGeneration: GenerationProgress[];
  variants: Record<VariantCategory, Progress>;
  ownedCards: OwnedCardDetail[];
  ownedCardIds: Set<string>;
  wishedCardIds: Set<string>;
  wishlistCount: number;
  collectionValue: number;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: IoniconName;
  unlocked: (stats: DashboardStats) => boolean;
}

const regionName = (label: string) => label.split('·')[1]?.trim() ?? label;
const isComplete = (p: Progress) => p.total > 0 && p.owned >= p.total;

const generationBadges: Badge[] = GENERATIONS.map(g => ({
  id: `gen-${g.gen}`,
  label: `Maître de ${regionName(g.label)}`,
  description: `Compléter tous les Pokémon de ${regionName(g.label)}`,
  icon: 'ribbon',
  unlocked: (stats) => isComplete(stats.byGeneration.find(gp => gp.gen === g.gen) ?? { owned: 0, total: 0, pct: 0 }),
}));

const milestoneBadges: Badge[] = [
  { pct: 25, label: 'Explorateur', icon: 'compass' as const },
  { pct: 50, label: 'Collectionneur', icon: 'albums' as const },
  { pct: 75, label: 'Expert', icon: 'star' as const },
  { pct: 100, label: 'Maître Pokédex', icon: 'trophy' as const },
].map(({ pct, label, icon }) => ({
  id: `national-${pct}`,
  label,
  description: `Atteindre ${pct}% du Pokédex National`,
  icon,
  unlocked: (stats: DashboardStats) => stats.overall.pct >= pct,
}));

const variantBadges: Badge[] = [
  { category: 'mega' as const, label: 'Collectionneur Méga', description: 'Posséder toutes les cartes Méga-Évolution' },
  { category: 'alolan' as const, label: 'Explorateur Alola', description: 'Posséder toutes les cartes de formes d’Alola' },
  { category: 'galarian' as const, label: 'Explorateur Galar', description: 'Posséder toutes les cartes de formes de Galar' },
  { category: 'hisuian' as const, label: 'Explorateur Hisui', description: 'Posséder toutes les cartes de formes d’Hisui' },
  { category: 'paldean' as const, label: 'Explorateur Paldea', description: 'Posséder toutes les cartes de formes de Paldea' },
].map(({ category, label, description }) => ({
  id: `variant-${category}`,
  label,
  description,
  icon: 'sparkles' as const,
  unlocked: (stats: DashboardStats) => isComplete(stats.variants[category]),
}));

// Rarity naming isn't strictly ordered across 30+ years of sets, so these tiers are a
// curated heuristic rather than a canonical ranking.
const BASIC_RARITIES = new Set(['Common', 'Uncommon', 'Promo', 'Rare']);
const isHoloTier = (rarity: string | null) => !!rarity && !BASIC_RARITIES.has(rarity);

const CHASE_RARITIES = new Set([
  'Rare Secret', 'Rare Rainbow', 'Rare Shining', 'Rare Shiny', 'Rare Shiny GX',
  'Shiny Rare', 'Shiny Ultra Rare', 'Ultra Rare', 'Hyper Rare', 'Mega Hyper Rare',
  'Special Illustration Rare', 'Illustration Rare', 'Amazing Rare', 'Radiant Rare',
  'Rare Prism Star', 'LEGEND',
]);
const isChaseTier = (rarity: string | null) => !!rarity && CHASE_RARITIES.has(rarity);

const rarityBadges: Badge[] = [
  {
    id: 'rarity-holo',
    label: 'Chasseur de Rares',
    description: 'Posséder au moins une carte de rareté Rare Holo ou supérieure',
    icon: 'diamond',
    unlocked: (stats) => stats.ownedCards.some(c => isHoloTier(c.rarity)),
  },
  {
    id: 'rarity-chase',
    label: 'Chromatique',
    description: 'Posséder au moins une carte Secret/Rainbow/Illustration Rare (ou équivalent)',
    icon: 'color-wand',
    unlocked: (stats) => stats.ownedCards.some(c => isChaseTier(c.rarity)),
  },
];

// Fixed-length 7-day buckets from the Unix epoch — avoids ISO-calendar-week edge cases
// (year boundaries) while still giving a stable "one slot per rolling week" grouping.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function maxCardsInAnyWeek(dates: string[]): number {
  const times = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
  let max = 0;
  for (let i = 0; i < times.length; i++) {
    let count = 1;
    for (let j = i + 1; j < times.length && times[j] - times[i] < WEEK_MS; j++) count++;
    if (count > max) max = count;
  }
  return max;
}

function hasFourConsecutiveActiveWeeks(dates: string[]): boolean {
  const weekIndices = new Set(dates.map(d => Math.floor(new Date(d).getTime() / WEEK_MS)));
  for (const w of weekIndices) {
    if ([0, 1, 2, 3].every(offset => weekIndices.has(w + offset))) return true;
  }
  return false;
}

const dateBadges: Badge[] = [
  {
    id: 'date-first',
    label: 'Premier Ajout',
    description: 'Ajouter ta toute première carte à la collection',
    icon: 'flag',
    unlocked: (stats) => stats.ownedCards.length > 0,
  },
  {
    id: 'date-sprint',
    label: 'Sprint',
    description: 'Ajouter 10 cartes en l’espace de 7 jours',
    icon: 'flash',
    unlocked: (stats) => maxCardsInAnyWeek(stats.ownedCards.map(c => c.acquiredAt)) >= 10,
  },
  {
    id: 'date-streak',
    label: 'Habitué',
    description: 'Ajouter au moins une carte chaque semaine, 4 semaines de suite',
    icon: 'calendar',
    unlocked: (stats) => hasFourConsecutiveActiveWeeks(stats.ownedCards.map(c => c.acquiredAt)),
  },
];

const wishlistBadges: Badge[] = [
  {
    id: 'wish-fulfilled',
    label: 'Vœu Exaucé',
    description: 'Obtenir une carte qui était dans ta wishlist',
    icon: 'heart',
    unlocked: (stats) => [...stats.wishedCardIds].some(id => stats.ownedCardIds.has(id)),
  },
  {
    id: 'wish-dreamer',
    label: 'Rêveur',
    description: 'Avoir au moins 10 cartes dans ta wishlist',
    icon: 'moon',
    unlocked: (stats) => stats.wishlistCount >= 10,
  },
];

const valueBadges: Badge[] = [
  { threshold: 100, label: 'Petit Trésor', icon: 'cash' as const },
  { threshold: 500, label: 'Coffre-Fort', icon: 'lock-closed' as const },
  { threshold: 1000, label: 'Trésor de Guerre', icon: 'shield' as const },
  { threshold: 5000, label: 'Légende Vivante', icon: 'flame' as const },
].map(({ threshold, label, icon }) => ({
  id: `value-${threshold}`,
  label,
  description: `Atteindre ${threshold}€ de valeur de collection estimée`,
  icon,
  unlocked: (stats: DashboardStats) => stats.collectionValue >= threshold,
}));

const artistBadges: Badge[] = [
  {
    id: 'artist-fan',
    label: 'Fan d’Artiste',
    description: 'Posséder au moins 5 cartes illustrées par le même artiste',
    icon: 'color-palette',
    unlocked: (stats) => topArtists(stats.ownedCards, 1).some(a => a.count >= 5),
  },
];

export const BADGES: Badge[] = [
  ...milestoneBadges, ...generationBadges, ...variantBadges,
  ...rarityBadges, ...dateBadges, ...wishlistBadges,
  ...valueBadges, ...artistBadges,
];

export function computeBadges(stats: DashboardStats): (Badge & { unlockedNow: boolean })[] {
  return BADGES.map(badge => ({ ...badge, unlockedNow: badge.unlocked(stats) }));
}
