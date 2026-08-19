import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { GENERATIONS } from './generations';
import type { GenerationProgress, Progress, VariantCategory } from './dashboard-stats';
import { topArtists } from './dashboard-stats';
import type { OwnedCardDetail } from './collection';
import { SET_TIERS, getSetTierLabel } from './set-tiers';
import { classifyRarity } from './rarity-tiers';
import type { Locale } from './locale';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface SetBadgeInfo {
  setId: string;
  setName: string;
  symbol: string | null;
  owned: number;
  total: number;
}

export interface DashboardStats {
  overall: Progress;
  byGeneration: GenerationProgress[];
  variants: Record<VariantCategory, Progress>;
  ownedCards: OwnedCardDetail[];
  ownedCardIds: Set<string>;
  wishedCardIds: Set<string>;
  wishlistCount: number;
  collectionValue: number;
  bySet: SetBadgeInfo[];
  completedTradesCount: number;
}

interface LocalizedText { fr: string; en: string; }

// Internal shape — label/description carry both locales; computeBadges()
// resolves them to plain strings for the public Badge/ComputedBadge types
// below, so every consumer (AchievementBadge, BadgeDetailModal...) keeps
// working with simple strings and doesn't need to know about locale.
interface BadgeDef {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
  icon: IoniconName;
  iconUri?: string;
  unlocked: (stats: DashboardStats) => boolean;
  progress?: (stats: DashboardStats) => number;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: IoniconName;
  iconUri?: string;
}

const isComplete = (p: Progress) => p.total > 0 && p.owned >= p.total;

const generationBadges: BadgeDef[] = GENERATIONS.map(g => {
  const regionFr = g.label.split('·')[1]?.trim() ?? g.label;
  const regionEn = g.labelEn.split('·')[1]?.trim() ?? g.labelEn;
  return {
    id: `gen-${g.gen}`,
    label: { fr: `Maître de ${regionFr}`, en: `${regionEn} Master` },
    description: { fr: `Compléter tous les Pokémon de ${regionFr}`, en: `Complete every ${regionEn} Pokémon` },
    icon: 'ribbon',
    unlocked: (stats) => isComplete(stats.byGeneration.find(gp => gp.gen === g.gen) ?? { owned: 0, total: 0, pct: 0 }),
    progress: (stats) => stats.byGeneration.find(gp => gp.gen === g.gen)?.pct ?? 0,
  };
});

const milestoneBadges: BadgeDef[] = [
  { pct: 25, label: { fr: 'Explorateur', en: 'Explorer' }, icon: 'compass' as const },
  { pct: 50, label: { fr: 'Collectionneur', en: 'Collector' }, icon: 'albums' as const },
  { pct: 75, label: { fr: 'Expert', en: 'Expert' }, icon: 'star' as const },
  { pct: 100, label: { fr: 'Maître Pokédex', en: 'Pokédex Master' }, icon: 'trophy' as const },
].map(({ pct, label, icon }) => ({
  id: `national-${pct}`,
  label,
  description: { fr: `Atteindre ${pct}% du Pokédex National`, en: `Reach ${pct}% of the National Pokédex` },
  icon,
  unlocked: (stats: DashboardStats) => stats.overall.pct >= pct,
  progress: (stats: DashboardStats) => Math.min(100, Math.round((stats.overall.pct / pct) * 100)),
}));

const variantBadges: BadgeDef[] = [
  { category: 'mega' as const, label: { fr: 'Collectionneur Méga', en: 'Mega Collector' }, description: { fr: 'Posséder toutes les cartes Méga-Évolution', en: 'Own every Mega Evolution card' } },
  { category: 'alolan' as const, label: { fr: 'Explorateur Alola', en: 'Alola Explorer' }, description: { fr: 'Posséder toutes les cartes de formes d’Alola', en: 'Own every Alolan form card' } },
  { category: 'galarian' as const, label: { fr: 'Explorateur Galar', en: 'Galar Explorer' }, description: { fr: 'Posséder toutes les cartes de formes de Galar', en: 'Own every Galarian form card' } },
  { category: 'hisuian' as const, label: { fr: 'Explorateur Hisui', en: 'Hisui Explorer' }, description: { fr: 'Posséder toutes les cartes de formes d’Hisui', en: 'Own every Hisuian form card' } },
  { category: 'paldean' as const, label: { fr: 'Explorateur Paldea', en: 'Paldea Explorer' }, description: { fr: 'Posséder toutes les cartes de formes de Paldea', en: 'Own every Paldean form card' } },
  { category: 'rotom' as const, label: { fr: 'Électricien', en: 'Electrician' }, description: { fr: 'Posséder toutes les cartes des formes appareil de Rotom', en: 'Own every Rotom appliance form card' } },
  { category: 'deoxys' as const, label: { fr: 'Métamorphe', en: 'Shapeshifter' }, description: { fr: 'Posséder toutes les cartes des formes de combat de Deoxys', en: 'Own every Deoxys combat form card' } },
  { category: 'gigamax' as const, label: { fr: 'Dynamax', en: 'Dynamax' }, description: { fr: 'Posséder toutes les cartes VMAX', en: 'Own every VMAX card' } },
].map(({ category, label, description }) => ({
  id: `variant-${category}`,
  label,
  description,
  icon: 'sparkles' as const,
  unlocked: (stats: DashboardStats) => isComplete(stats.variants[category]),
  progress: (stats: DashboardStats) => stats.variants[category].pct,
}));

const isHoloTier = (rarity: string | null) => classifyRarity(rarity) !== 'basic';
const isChaseTier = (rarity: string | null) => classifyRarity(rarity) === 'chase';

const rarityBadges: BadgeDef[] = [
  {
    id: 'rarity-holo',
    label: { fr: 'Chasseur de Rares', en: 'Rare Hunter' },
    description: { fr: 'Posséder au moins une carte de rareté Rare Holo ou supérieure', en: 'Own at least one Rare Holo (or higher) rarity card' },
    icon: 'diamond',
    unlocked: (stats) => stats.ownedCards.some(c => isHoloTier(c.rarity)),
  },
  {
    id: 'rarity-chase',
    label: { fr: 'Chromatique', en: 'Chromatic' },
    description: { fr: 'Posséder au moins une carte Secret/Rainbow/Illustration Rare (ou équivalent)', en: 'Own at least one Secret/Rainbow/Illustration Rare card (or equivalent)' },
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

const dateBadges: BadgeDef[] = [
  {
    id: 'date-first',
    label: { fr: 'Premier Ajout', en: 'First Add' },
    description: { fr: 'Ajouter ta toute première carte à la collection', en: 'Add your very first card to the collection' },
    icon: 'flag',
    unlocked: (stats) => stats.ownedCards.length > 0,
  },
  {
    id: 'date-sprint',
    label: { fr: 'Sprint', en: 'Sprint' },
    description: { fr: 'Ajouter 10 cartes en l’espace de 7 jours', en: 'Add 10 cards within 7 days' },
    icon: 'flash',
    unlocked: (stats) => maxCardsInAnyWeek(stats.ownedCards.map(c => c.acquiredAt)) >= 10,
  },
  {
    id: 'date-streak',
    label: { fr: 'Habitué', en: 'Regular' },
    description: { fr: 'Ajouter au moins une carte chaque semaine, 4 semaines de suite', en: 'Add at least one card every week, 4 weeks in a row' },
    icon: 'calendar',
    unlocked: (stats) => hasFourConsecutiveActiveWeeks(stats.ownedCards.map(c => c.acquiredAt)),
  },
];

const wishlistBadges: BadgeDef[] = [
  {
    id: 'wish-fulfilled',
    label: { fr: 'Vœu Exaucé', en: 'Wish Granted' },
    description: { fr: 'Obtenir une carte qui était dans ta wishlist', en: 'Get a card that was on your wishlist' },
    icon: 'heart',
    unlocked: (stats) => [...stats.wishedCardIds].some(id => stats.ownedCardIds.has(id)),
  },
  {
    id: 'wish-dreamer',
    label: { fr: 'Rêveur', en: 'Dreamer' },
    description: { fr: 'Avoir au moins 10 cartes dans ta wishlist', en: 'Have at least 10 cards on your wishlist' },
    icon: 'moon',
    unlocked: (stats) => stats.wishlistCount >= 10,
  },
];

const valueBadges: BadgeDef[] = [
  { threshold: 100, label: { fr: 'Petit Trésor', en: 'Small Treasure' }, icon: 'cash' as const },
  { threshold: 500, label: { fr: 'Coffre-Fort', en: 'Safe' }, icon: 'lock-closed' as const },
  { threshold: 1000, label: { fr: 'Trésor de Guerre', en: 'War Chest' }, icon: 'shield' as const },
  { threshold: 5000, label: { fr: 'Légende Vivante', en: 'Living Legend' }, icon: 'flame' as const },
].map(({ threshold, label, icon }) => ({
  id: `value-${threshold}`,
  label,
  description: { fr: `Atteindre ${threshold}€ de valeur de collection estimée`, en: `Reach €${threshold} of estimated collection value` },
  icon,
  unlocked: (stats: DashboardStats) => stats.collectionValue >= threshold,
  progress: (stats: DashboardStats) => Math.min(100, Math.round((stats.collectionValue / threshold) * 100)),
}));

const tradeBadges: BadgeDef[] = [
  { threshold: 1, label: { fr: 'Premier Échange', en: 'First Trade' }, icon: 'swap-horizontal' as const },
  { threshold: 5, label: { fr: 'Négociant', en: 'Trader' }, icon: 'people-circle' as const },
  { threshold: 15, label: { fr: 'Maître Troqueur', en: 'Trade Master' }, icon: 'trophy' as const },
].map(({ threshold, label, icon }) => ({
  id: `trade-${threshold}`,
  label,
  description: {
    fr: `Compléter ${threshold} échange${threshold > 1 ? 's' : ''} avec des amis`,
    en: `Complete ${threshold} trade${threshold > 1 ? 's' : ''} with friends`,
  },
  icon,
  unlocked: (stats: DashboardStats) => stats.completedTradesCount >= threshold,
  progress: (stats: DashboardStats) => Math.min(100, Math.round((stats.completedTradesCount / threshold) * 100)),
}));

const artistBadges: BadgeDef[] = [
  {
    id: 'artist-fan',
    label: { fr: 'Fan d’Artiste', en: 'Artist Fan' },
    description: { fr: 'Posséder au moins 5 cartes illustrées par le même artiste', en: 'Own at least 5 cards illustrated by the same artist' },
    icon: 'color-palette',
    unlocked: (stats) => topArtists(stats.ownedCards, 1).some(a => a.count >= 5),
  },
];

const BADGES: BadgeDef[] = [
  ...milestoneBadges, ...generationBadges, ...variantBadges,
  ...rarityBadges, ...dateBadges, ...wishlistBadges,
  ...valueBadges, ...artistBadges, ...tradeBadges,
];

// Same tiered shape as milestoneBadges (national dex), applied per pinned set —
// dynamic (depends on which sets the user pinned), so built per-call from
// stats.bySet rather than living in the static BADGES list. Tier definitions
// are shared with the ring/trophy treatment on SetGoalTile/pinned-set.
function buildSetBadges(bySet: SetBadgeInfo[], locale: Locale): BadgeDef[] {
  const badges: BadgeDef[] = [];
  for (const s of bySet) {
    const pct = s.total > 0 ? Math.round((s.owned / s.total) * 100) : 0;
    for (const tier of SET_TIERS) {
      const tierLabel = getSetTierLabel(tier, locale);
      badges.push({
        id: `set-${s.setId}-${tier.pct}`,
        label: { fr: `${s.setName} — ${tierLabel}`, en: `${s.setName} — ${tierLabel}` },
        description: {
          fr: `Atteindre ${tier.pct}% de l’extension ${s.setName}`,
          en: `Reach ${tier.pct}% of the ${s.setName} set`,
        },
        icon: tier.icon,
        iconUri: s.symbol ?? undefined,
        unlocked: () => pct >= tier.pct,
        progress: () => Math.min(100, Math.round((pct / tier.pct) * 100)),
      });
    }
  }
  return badges;
}

export interface ComputedBadge extends Badge {
  unlockedNow: boolean;
  progressNow?: number;
}

export function computeBadges(stats: DashboardStats, locale: Locale = 'fr'): ComputedBadge[] {
  const all = [...BADGES, ...buildSetBadges(stats.bySet, locale)];
  return all.map(badge => ({
    id: badge.id,
    label: badge.label[locale],
    description: badge.description[locale],
    icon: badge.icon,
    iconUri: badge.iconUri,
    unlockedNow: badge.unlocked(stats),
    progressNow: badge.progress?.(stats),
  }));
}
