import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Locale } from './locale';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface SetTier {
  pct: number;
  label: string;
  labelEn: string;
  color: string;
  icon: IoniconName;
}

// Shared between the badge wall (lib/badges.ts) and the progress ring/trophy
// treatment on SetGoalTile / pinned-set — a set is "extremely hard" to finish
// at 100%, so both reward and visually mark every tier crossed, not just the
// final one.
export const SET_TIERS: SetTier[] = [
  { pct: 25, label: 'Découverte', labelEn: 'Discovery', color: '#cd7f32', icon: 'compass' },
  { pct: 50, label: 'Collection', labelEn: 'Collection', color: '#c0c0c0', icon: 'albums' },
  { pct: 75, label: 'Expertise', labelEn: 'Expertise', color: '#e0b34a', icon: 'star' },
  { pct: 90, label: 'Presque complet', labelEn: 'Almost complete', color: '#fbbf24', icon: 'ribbon' },
  { pct: 100, label: 'Set complet', labelEn: 'Complete set', color: '#facc15', icon: 'trophy' },
];

export function getSetTierLabel(tier: SetTier, locale: Locale): string {
  return locale === 'en' ? tier.labelEn : tier.label;
}

export function currentSetTier(pct: number): SetTier | undefined {
  let best: SetTier | undefined;
  for (const tier of SET_TIERS) {
    if (pct >= tier.pct) best = tier;
  }
  return best;
}
