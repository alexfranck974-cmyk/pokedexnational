import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, Easing, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { useSession } from '@/lib/auth';
import { useUserDex, useAllOwnedCardsDetailed, useAllOwnedCardsLedgerDetailed, useAllWishedCards, useOwnedCardQuantities } from '@/lib/collection';
import { useShowcase } from '@/lib/favorites';
import { useSetGoals, useToggleSetGoal } from '@/lib/collection-goals';
import { useTcgSets } from '@/lib/tcg-index';
import { enterPokemonDetail, withReturnTo } from '@/lib/navigation';
import { totalCollectionValue, computeSetGoalsProgress, averageProgress } from '@/lib/dashboard-stats';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { eurFormatter } from '@/lib/trades';
import { useLocale, useT } from '@/lib/locale';
import { PokedexHeroCard } from '@/components/PokedexHeroCard';
import { NewSetBanner } from '@/components/NewSetBanner';
import { BadgesSection } from '@/components/BadgesSection';
import { VitrineCarousel } from '@/components/VitrineCarousel';
import { CardZoomModal } from '@/components/CardZoomModal';
import { RingMenuItem } from '@/components/RingMenuItem';
import { SetGoalTile } from '@/components/SetGoalTile';
import { SetGoalPicker } from '@/components/SetGoalPicker';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TradeHistoryModal } from '@/components/TradeHistoryModal';
import { RefreshButton } from '@/components/RefreshButton';
import { useCompletedTradesCount } from '@/lib/trades';
import { useTheme, useThemedStyles, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useMotion } from '@/lib/motion';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';

// SetGoalTile's rendered height (ring + 2 text lines + tile padding) — fixed rather
// than measured via onLayout so the accordion animation doesn't depend on a layout
// pass completing first.
const COLLECTION_ROW_HEIGHT = 130;

const POKEDEX = pokedexData as Pokemon[];
const OBJECTIVES_TINT = '#38bdf8';
const TRADE_TINT = '#2dd4bf';
const CARDS_TINT = '#a78bfa';

export default function DashboardScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();
  const { session } = useSession();
  const userId = session?.user.id;
  const joinedAt = session?.user.created_at;
  const { data: owned = new Set<number>(), isLoading: dexLoading } = useUserDex(userId);
  const { data: ownedCards = [] } = useAllOwnedCardsDetailed(userId);
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: ownedQuantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  // Distinct from the National Dex ring (one official card per Pokémon) —
  // this is the raw physical count, duplicates included.
  const totalCardsOwned = useMemo(
    () => Array.from(ownedQuantities.values()).reduce((sum, q) => sum + q, 0),
    [ownedQuantities],
  );
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [tradeHistoryOpen, setTradeHistoryOpen] = useState(false);
  const [unpinTarget, setUnpinTarget] = useState<{ setId: string; setName: string } | null>(null);
  const { data: completedTradesCount = 0 } = useCompletedTradesCount(userId);
  const { data: goals = [] } = useSetGoals(userId);
  const { data: allSets = [] } = useTcgSets();
  const toggleGoal = useToggleSetGoal();
  const setsById = useMemo(() => new Map(allSets.map(s => [s.id, s])), [allSets]);
  const pinnedSetIds = useMemo(() => new Set(goals.map(g => g.setId)), [goals]);
  const goalsProgress = useMemo(() => computeSetGoalsProgress(goals, ledgerCards, allSets), [goals, ledgerCards, allSets]);
  const collectionAvgPct = useMemo(() => averageProgress(goalsProgress), [goalsProgress]);
  const { animationsEnabled } = useMotion();
  const [collectionExpanded, setCollectionExpanded] = useState(false);
  const collectionAccordionHeight = useRef(new Animated.Value(0)).current;
  const toggleCollectionExpanded = () => {
    const next = !collectionExpanded;
    setCollectionExpanded(next);
    const target = next ? COLLECTION_ROW_HEIGHT : 0;
    if (!animationsEnabled) {
      collectionAccordionHeight.setValue(target);
      return;
    }
    Animated.timing(collectionAccordionHeight, {
      toValue: target,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const wishedCardIds = useMemo(() => new Set(wishedCards.map((c: { id: string }) => c.id)), [wishedCards]);
  const collectionValue = useMemo(() => totalCollectionValue(ledgerCards, ownedQuantities), [ledgerCards, ownedQuantities]);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const ownedCardsByDex = useMemo(() => new Map(ownedCards.map(c => [c.dexNum, c])), [ownedCards]);
  const vitrineCards = useMemo(() => Array.from(showcase)
    .map(dexNum => ownedCardsByDex.get(dexNum))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .slice(0, 6), [showcase, ownedCardsByDex]);
  const vitrineItems = useMemo(() => vitrineCards.map((c, i) => ({
    key: c.cardId,
    image: c.imageLarge ?? c.imageSmall,
    onPress: () => setZoomIndex(i),
  })), [vitrineCards]);
  const zoomCard = zoomIndex !== null ? vitrineCards[zoomIndex] : null;

  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();
  const styles = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
    scroll: { padding: spacing.lg, paddingBottom: spacing.lg + TAB_BAR_CLEARANCE, gap: spacing.lg },
    titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    h1: { fontSize: 30, fontFamily: fonts.display, color: colors.text },
    collectionValue: { fontSize: 15, fontFamily: fonts.monoBold, color: colors.success },

    // Loose zigzag rather than a straight row — a "nebula" cluster feel without
    // true randomness, which would be unreliable to keep readable/tappable
    // across phone and desktop widths.
    // `center` + a fixed `gap` (not `space-around`) so the cluster stays tight
    // on wide desktop viewports instead of the rings drifting apart with the
    // container — nothing in this app caps screen width, so this row has to
    // hold its own shape regardless of how wide the page gets.
    // flexWrap is a safety net, not the primary fix — at 4 rings x 64px this
    // still fits one row down to ~320px width, but wrapping beats letting a
    // ring get clipped off-screen if it ever doesn't (bigger font scale, an
    // extra ring added later, etc). rowGap/columnGap so a wrapped 2nd row
    // doesn't lose the horizontal gap that `gap` would otherwise apply to both axes.
    nebula: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const,
      alignItems: 'flex-start' as const, rowGap: spacing.lg, columnGap: spacing.lg,
    },
    nebulaItemMid: { marginTop: 26 },
    nebulaItemThird: { marginTop: 10 },
    nebulaItemLast: { marginTop: 22 },
    addBadge: {
      position: 'absolute' as const, bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const,
      borderWidth: 2, borderColor: colors.bg,
    },
  }));

  if (dexLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        {...hideOnScrollProps}>
        <View style={styles.titleRow}>
          <Text style={styles.h1}>{t('dashboard.title')}</Text>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
        </View>
        <Text style={styles.collectionValue}>
          {t('dashboard.collectionValueLabel', { value: eurFormatter(locale).format(collectionValue) })}
        </Text>

        <NewSetBanner userId={userId} joinedAt={joinedAt} />

        <VitrineCarousel items={vitrineItems} />

        <PokedexHeroCard
          userId={userId}
          onSelectMissing={(dexNum) => enterPokemonDetail(router, `/pokemon/${dexNum}`, '/dashboard')}
        />

        <View style={styles.nebula}>
          <RingMenuItem
            tint={OBJECTIVES_TINT}
            pct={goals.length > 0 ? collectionAvgPct : undefined}
            centerLabel={goals.length > 0 ? `${collectionAvgPct}%` : '+'}
            label={t('dashboard.collectionLabel')}
            onPress={() => goals.length === 0 ? setGoalPickerOpen(true) : toggleCollectionExpanded()}
            badge={
              <Pressable onPress={() => setGoalPickerOpen(true)} hitSlop={6} style={styles.addBadge}>
                <Ionicons name="add" size={13} color="white" />
              </Pressable>
            }
          />
          <View style={styles.nebulaItemMid}>
            <BadgesSection
              userId={userId}
              wishedCardIds={wishedCardIds}
              wishlistCount={wishedCards.length}
            />
          </View>
          <View style={styles.nebulaItemThird}>
            <RingMenuItem
              tint={TRADE_TINT}
              centerLabel={String(completedTradesCount)}
              centerSub={t('dashboard.tradesSub')}
              label={t('dashboard.tradesLabel')}
              onPress={() => setTradeHistoryOpen(true)}
            />
          </View>
          <View style={styles.nebulaItemLast}>
            <RingMenuItem
              tint={CARDS_TINT}
              centerLabel={String(totalCardsOwned)}
              centerSub={t('dashboard.cardsSub')}
              label={t('dashboard.ownedLabel')}
              onPress={() => router.push('/favorites' as never)}
            />
          </View>
        </View>

        {goals.length > 0 && (
          <Animated.View style={{ height: collectionAccordionHeight, overflow: 'hidden' as const }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {goals.map(g => {
                const set = setsById.get(g.setId);
                if (!set) return null;
                const setName = setFlagLabel(set.name, set.region);
                return (
                  <SetGoalTile
                    key={g.setId}
                    userId={userId}
                    setId={g.setId}
                    setName={setName}
                    total={set.cardCount}
                    symbol={set.symbol}
                    onPress={() => router.push(withReturnTo(`/pinned-set/${g.setId}`, '/dashboard') as never)}
                    onUnpin={() => setUnpinTarget({ setId: g.setId, setName })}
                  />
                );
              })}
            </ScrollView>
          </Animated.View>
        )}
      </ScrollView>
      <CardZoomModal
        card={zoomCard ? { image_small: zoomCard.imageSmall, image_large: zoomCard.imageLarge } : null}
        onClose={() => setZoomIndex(null)}
        onSwipeNext={() => setZoomIndex(i => i === null ? null : (i + 1) % vitrineCards.length)}
        onSwipePrev={() => setZoomIndex(i => i === null ? null : (i - 1 + vitrineCards.length) % vitrineCards.length)}
      />
      <SetGoalPicker visible={goalPickerOpen} pinnedSetIds={pinnedSetIds} tint={OBJECTIVES_TINT} onClose={() => setGoalPickerOpen(false)} />
      <ConfirmDialog
        target={unpinTarget ? { title: t('dashboard.unpinTitle'), message: t('dashboard.unpinMessage', { name: unpinTarget.setName }) } : null}
        confirmLabel={t('common.unpin')}
        onConfirm={() => {
          if (unpinTarget) toggleGoal.mutate({ setId: unpinTarget.setId, currentlyPinned: true });
          setUnpinTarget(null);
        }}
        onCancel={() => setUnpinTarget(null)}
      />
      <TradeHistoryModal userId={userId} visible={tradeHistoryOpen} onClose={() => setTradeHistoryOpen(false)} />
    </SafeAreaView>
  );
}
