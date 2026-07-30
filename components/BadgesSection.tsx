import { useMemo, useState } from 'react';
import { useUserDex, useAllOwnedCardIds, useAllOwnedCardsDetailed, useAllOwnedCardsLedgerDetailed } from '@/lib/collection';
import { useSetGoals } from '@/lib/collection-goals';
import { useVariantCards, useTcgSets } from '@/lib/tcg-index';
import {
  computeOverallProgress, computeByGeneration,
  bucketVariantCards, computeVariantProgress, totalCollectionValue, computeSetGoalsProgress,
} from '@/lib/dashboard-stats';
import { computeBadges, type DashboardStats } from '@/lib/badges';
import { useCompletedTradesCount } from '@/lib/trades';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { AllBadgesModal } from './AllBadgesModal';
import { RingMenuItem } from './RingMenuItem';
import { useTheme } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

interface Props {
  userId?: string;
  /** Wishlist-derived badge inputs — owner passes real data, spectator view can omit (defaults to empty). */
  wishedCardIds?: Set<string>;
  wishlistCount?: number;
  /** Hide the €-denominated badges (collection value tiers) for spectator views. */
  showValueBadges?: boolean;
}

// Renders as a single ring menu item (unlocked/total badges) — tapping it
// opens the full AllBadgesModal, which owns its own badge-detail drill-down.
export function BadgesSection({
  userId, wishedCardIds = new Set(), wishlistCount = 0, showValueBadges = true,
}: Props) {
  const { colors } = useTheme();
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: ownedCards = [] } = useAllOwnedCardsDetailed(userId);
  const { data: variantCards = [] } = useVariantCards();
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: pinnedGoals = [] } = useSetGoals(userId);
  const { data: allSets = [] } = useTcgSets();
  const { data: completedTradesCount = 0 } = useCompletedTradesCount(userId);
  const [allBadgesOpen, setAllBadgesOpen] = useState(false);

  const overall = useMemo(() => computeOverallProgress(POKEDEX, owned), [owned]);
  const byGeneration = useMemo(() => computeByGeneration(POKEDEX, owned), [owned]);
  const variantBuckets = useMemo(() => bucketVariantCards(variantCards), [variantCards]);
  const variants = useMemo(
    () => computeVariantProgress(variantBuckets, ownedCardIds),
    [variantBuckets, ownedCardIds],
  );
  const collectionValue = useMemo(() => totalCollectionValue(ownedCards), [ownedCards]);
  const bySet = useMemo(
    () => computeSetGoalsProgress(pinnedGoals, ledgerCards, allSets),
    [ledgerCards, pinnedGoals, allSets],
  );

  const badges = useMemo(() => {
    const stats: DashboardStats = {
      overall, byGeneration, variants, ownedCards, ownedCardIds,
      wishedCardIds, wishlistCount, collectionValue, bySet, completedTradesCount,
    };
    const all = computeBadges(stats);
    return showValueBadges ? all : all.filter(b => !b.id.startsWith('value-'));
  }, [overall, byGeneration, variants, ownedCards, ownedCardIds, wishedCardIds, wishlistCount, collectionValue, bySet, completedTradesCount, showValueBadges]);

  const unlockedCount = useMemo(() => badges.filter(b => b.unlockedNow).length, [badges]);
  const pct = badges.length > 0 ? Math.round((unlockedCount / badges.length) * 100) : 0;

  return (
    <>
      <RingMenuItem
        tint={colors.warning}
        pct={pct}
        centerLabel={String(unlockedCount)}
        centerSub={`/${badges.length}`}
        label="Badges"
        onPress={() => setAllBadgesOpen(true)}
      />
      <AllBadgesModal
        visible={allBadgesOpen}
        badges={badges}
        tint={colors.warning}
        onClose={() => setAllBadgesOpen(false)}
      />
    </>
  );
}
