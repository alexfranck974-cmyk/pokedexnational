import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserDex, useAllOwnedCardIds, useAllOwnedCardsDetailed, useAllOwnedCardsLedgerDetailed } from '@/lib/collection';
import { useSetGoals } from '@/lib/collection-goals';
import { useVariantCards, useTcgSets } from '@/lib/tcg-index';
import {
  computeOverallProgress, computeByGeneration,
  bucketVariantCards, computeVariantProgress, totalCollectionValue,
} from '@/lib/dashboard-stats';
import { computeBadges, pickAlmostUnlocked, type DashboardStats } from '@/lib/badges';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { AchievementBadge } from './AchievementBadge';
import { BadgeDetailModal, type BadgeDetailTarget } from './BadgeDetailModal';
import { AllBadgesModal } from './AllBadgesModal';
import { ProgressRing } from './ProgressRing';
import { IconBubble } from './IconBubble';
import { Bubble } from './Bubble';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

interface Props {
  userId?: string;
  /** Wishlist-derived badge inputs — owner passes real data, spectator view can omit (defaults to empty). */
  wishedCardIds?: Set<string>;
  wishlistCount?: number;
  /** Hide the €-denominated badges (collection value tiers) for spectator views. */
  showValueBadges?: boolean;
}

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
  const [badgeDetail, setBadgeDetail] = useState<BadgeDetailTarget | null>(null);
  const [allBadgesOpen, setAllBadgesOpen] = useState(false);

  const overall = useMemo(() => computeOverallProgress(POKEDEX, owned), [owned]);
  const byGeneration = useMemo(() => computeByGeneration(POKEDEX, owned), [owned]);
  const variantBuckets = useMemo(() => bucketVariantCards(variantCards), [variantCards]);
  const variants = useMemo(
    () => computeVariantProgress(variantBuckets, ownedCardIds),
    [variantBuckets, ownedCardIds],
  );
  const collectionValue = useMemo(() => totalCollectionValue(ownedCards), [ownedCards]);
  const bySet = useMemo(() => {
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
          setId: g.setId,
          setName: set.name,
          symbol: set.symbol,
          owned: ownedCountBySet.get(g.setId) ?? 0,
          total: set.cardCount,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [ledgerCards, pinnedGoals, allSets]);

  const badges = useMemo(() => {
    const stats: DashboardStats = {
      overall, byGeneration, variants, ownedCards, ownedCardIds,
      wishedCardIds, wishlistCount, collectionValue, bySet,
    };
    const all = computeBadges(stats);
    return showValueBadges ? all : all.filter(b => !b.id.startsWith('value-'));
  }, [overall, byGeneration, variants, ownedCards, ownedCardIds, wishedCardIds, wishlistCount, collectionValue, bySet, showValueBadges]);

  const unlocked = useMemo(() => badges.filter(b => b.unlockedNow), [badges]);
  const almostUnlocked = useMemo(() => pickAlmostUnlocked(badges), [badges]);

  const styles = useThemedStyles((colors, shadow) => ({
    section: { gap: spacing.sm },
    sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    sectionTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text, flex: 1 },
    seeAll: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.primary },
    empty: {
      fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, fontStyle: 'italic' as const,
      textAlign: 'center' as const, padding: spacing.sm,
    },
    previewRow: { flexDirection: 'row' as const, gap: spacing.sm, paddingTop: spacing.sm },
    almostCard: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm,
    },
    almostCardPressed: { backgroundColor: colors.surfaceAlt },
    almostTextWrap: { flex: 1, gap: 2 },
    almostLabel: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.text },
    almostHint: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted },
  }));

  const preview = unlocked.slice(0, 6);

  return (
    <>
    <Bubble tint={colors.warning}>
      <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <IconBubble size={28} color={colors.primarySoft}>
          <Ionicons name="ribbon" size={15} color={colors.warning} />
        </IconBubble>
        <Text style={styles.sectionTitle}>Badges</Text>
        <Pressable onPress={() => setAllBadgesOpen(true)} hitSlop={8}>
          <Text style={styles.seeAll}>Voir tout ({badges.length})</Text>
        </Pressable>
      </View>

      {unlocked.length === 0 ? (
        <Text style={styles.empty}>Aucun badge débloqué pour l’instant — commence ta collection !</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {preview.map(b => (
            <AchievementBadge
              key={b.id}
              icon={b.icon}
              iconUri={b.iconUri}
              label={b.label}
              unlocked
              onPress={() => setBadgeDetail({ icon: b.icon, iconUri: b.iconUri, label: b.label, description: b.description, unlocked: true })}
            />
          ))}
        </ScrollView>
      )}

      {almostUnlocked && (
        <Pressable
          style={({ pressed }) => [styles.almostCard, pressed && styles.almostCardPressed]}
          onPress={() => setBadgeDetail({
            icon: almostUnlocked.icon, iconUri: almostUnlocked.iconUri, label: almostUnlocked.label,
            description: almostUnlocked.description, unlocked: false,
          })}>
          <ProgressRing pct={almostUnlocked.progressNow ?? 0} size={44} strokeWidth={5} color={colors.primary}>
            <Ionicons name={almostUnlocked.icon} size={16} color={colors.primary} />
          </ProgressRing>
          <View style={styles.almostTextWrap}>
            <Text style={styles.almostLabel} numberOfLines={1}>{almostUnlocked.label}</Text>
            <Text style={styles.almostHint}>Presque débloqué · {almostUnlocked.progressNow ?? 0}%</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>
      )}

      </View>
      </Bubble>
      <AllBadgesModal
        visible={allBadgesOpen}
        badges={badges}
        onClose={() => setAllBadgesOpen(false)}
      />
      <BadgeDetailModal target={badgeDetail} onClose={() => setBadgeDetail(null)} />
    </>
  );
}
