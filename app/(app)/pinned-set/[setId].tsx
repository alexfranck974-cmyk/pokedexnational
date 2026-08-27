import { useMemo, useState } from 'react';
import { View, Text, Image, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CardGallery } from '@/components/CardGallery';
import { CardZoomModal } from '@/components/CardZoomModal';
import { CardCopySheet, EditCopyFooterButton } from '@/components/CardCopySheet';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/EmptyState';
import { CaptureEffect, type CaptureEvent } from '@/components/CaptureEffect';
import type { TcgCardRow } from '@/lib/tcg';
import { useCardsForSet } from '@/lib/tcg';
import { useTcgSets } from '@/lib/tcg-index';
import { useSession } from '@/lib/auth';
import { useAllOwnedCardIds, useToggleOwnedCard, useOwnedCardQuantities, useAdjustOwnedCardQuantity, useAllWishedCards, useToggleWish, useOwnedCardFinishes } from '@/lib/collection';
import { useFriends } from '@/lib/friends';
import { useFriendsWantedCards } from '@/lib/trades';
import { TradeMatchPopup, type TradeMatch } from '@/components/TradeMatchPopup';
import { TradeProposalModal, type TradeTarget, type PickedCard } from '@/components/TradeProposalModal';
import { useBackTo } from '@/lib/navigation';
import { useHistoryBackGuard } from '@/lib/history-back-guard';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { currentSetTier } from '@/lib/set-tiers';
import { classifyRarity } from '@/lib/rarity-tiers';
import { buildSetTypeGroups, typesCompletedByToggle } from '@/lib/set-type-completion';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const COLUMN_CYCLE: (3 | 4 | null)[] = [null, 3, 4];

export default function PinnedSetDetail() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const router = useRouter();
  const goBack = useBackTo('/dashboard');

  // See lib/history-back-guard.ts for why this is needed and why it's capped
  // to one shared guard instead of pushing a fresh history entry per screen.
  useHistoryBackGuard(goBack);

  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: cards = [], isLoading: cardsLoading } = useCardsForSet(setId);
  const { data: ownedAll = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: finishesByCard } = useOwnedCardFinishes(userId);
  const { data: allSets = [] } = useTcgSets();
  const toggleOwned = useToggleOwnedCard();
  const adjustQuantity = useAdjustOwnedCardQuantity();
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const wishedSet = useMemo(() => new Set(wishedCards.map(c => c.id)), [wishedCards]);
  const toggleWish = useToggleWish();

  const { data: friends = [] } = useFriends(userId);
  const friendIdsArr = useMemo(() => friends.map(f => f.id), [friends]);
  const { data: wantedByFriends = [] } = useFriendsWantedCards(friendIdsArr);
  const [tradeMatch, setTradeMatch] = useState<TradeMatch | null>(null);
  const [tradeTarget, setTradeTarget] = useState<TradeTarget | null>(null);
  const [tradePreset, setTradePreset] = useState<PickedCard | undefined>(undefined);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [columns, setColumns] = useState<3 | 4 | null>(null);
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);
  const [detailsCard, setDetailsCard] = useState<TcgCardRow | null>(null);
  const [captureQueue, setCaptureQueue] = useState<CaptureEvent[]>([]);
  const currentCapture = captureQueue[0] ?? null;
  const typeGroups = useMemo(() => buildSetTypeGroups(cards), [cards]);

  const set = useMemo(() => allSets.find(s => s.id === setId), [allSets, setId]);
  const setName = set ? setFlagLabel(set.name, set.region) : (setId ?? '');
  const total = set?.cardCount ?? cards.length;
  const ownedCount = useMemo(() => cards.filter(c => ownedAll.has(c.id)).length, [cards, ownedAll]);
  // Card numbers are free-form strings (can include suffixes like "TG01"), so a plain
  // string sort would put "10" before "2" — numeric-aware localeCompare avoids that.
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.card_number.localeCompare(b.card_number, undefined, { numeric: true })),
    [cards],
  );
  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
  const tier = currentSetTier(pct);
  const year = set?.releaseDate ? new Date(set.releaseDate).getFullYear() : null;

  const { colors, heroGradient, heroText, heroTextMuted, heroSurface, heroSurfaceActive, heroSurfaceActiveText, heroTrack } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: { padding: spacing.md, gap: spacing.sm, ...shadow.sm },
    heroTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: heroText, fontSize: 14, fontFamily: fonts.body },
    heroViewToggle: { flexDirection: 'row' as const, gap: 6 },
    viewBtn: {
      width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: heroSurface,
    },
    viewBtnActive: { backgroundColor: heroSurfaceActive },
    columnsLabel: { fontSize: 12, fontFamily: fonts.monoBold, color: heroText },
    heroMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    heroLogo: { height: 64, width: '100%' as const, alignSelf: 'center' as const },
    heroName: { fontSize: 20, fontFamily: fonts.display, color: heroText },
    heroCaptionRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 2 },
    heroCaption: { fontSize: 12, fontFamily: fonts.mono, color: heroTextMuted },
    banner: {
      flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8,
      margin: spacing.sm, marginBottom: 0, padding: spacing.sm,
      backgroundColor: colors.primarySoft, borderRadius: radius.md,
    },
    bannerText: { flex: 1, fontSize: 11, fontFamily: fonts.body, color: colors.text, lineHeight: 15 },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={goBack} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={heroText} />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>
          <View style={styles.heroViewToggle}>
            <Pressable
              onPress={() => setViewMode('grid')}
              style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}>
              <Ionicons name="grid" size={15} color={viewMode === 'grid' ? heroSurfaceActiveText : heroText} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}>
              <Ionicons name="list" size={15} color={viewMode === 'list' ? heroSurfaceActiveText : heroText} />
            </Pressable>
            {viewMode === 'grid' && (
              <Pressable
                onPress={() => setColumns(c => COLUMN_CYCLE[(COLUMN_CYCLE.indexOf(c) + 1) % COLUMN_CYCLE.length])}
                style={styles.viewBtn}>
                {columns ? (
                  <Text style={styles.columnsLabel}>×{columns}</Text>
                ) : (
                  <Ionicons name="grid-outline" size={15} color={heroText} />
                )}
              </Pressable>
            )}
          </View>
        </View>
        {set?.logo && (
          <Image source={{ uri: set.logo }} style={styles.heroLogo} resizeMode="contain" accessibilityLabel={setName} />
        )}
        <View style={styles.heroMain}>
          <ProgressRing
            pct={pct} size={64} color={tier?.color ?? heroSurfaceActive}
            trackColor={heroTrack} centerLabel={`${pct}%`}
          />
          <View style={{ flex: 1 }}>
            {!set?.logo && <Text style={styles.heroName} numberOfLines={2}>{setName}</Text>}
            <View style={styles.heroCaptionRow}>
              {tier && <Ionicons name="trophy" size={14} color={tier.color} />}
              <Text style={styles.heroCaption}>
                {year ? `${year} · ` : ''}{ownedCount}/{total} cartes
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.banner}>
        <Ionicons name="information-circle" size={16} color={colors.primary} />
        <Text style={styles.bannerText}>
          Cocher une carte ici l'ajoute à ta collection de cartes possédées, sans changer ta carte
          choisie du Pokédex national — rends-toi sur sa fiche pour l'utiliser comme carte choisie
          si tu le souhaites.
        </Text>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <EmptyState icon="albums-outline" hint="Aucune carte connue pour cette extension." />
      ) : (
        <CardGallery
          cards={sortedCards}
          ownedSet={ownedAll}
          wishedSet={wishedSet}
          readOnly={false}
          viewMode={viewMode}
          columnsOverride={columns}
          quantities={quantities}
          onIncrement={c => {
            const currentQuantity = quantities.get(c.id) ?? 0;
            adjustQuantity.mutate(
              { cardId: c.id, delta: 1, currentQuantity, rarity: c.rarity },
              {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: ['set_goal_progress', userId, setId] });
                  // "Les doublons sont flaggés comme disponibles automatiquement" — the
                  // instant a card crosses into duplicate territory, check if a friend
                  // already wants it and surface it right away instead of waiting for
                  // them to browse the Marché tab.
                  if (currentQuantity + 1 === 2) {
                    const match = wantedByFriends.find(w => w.card.id === c.id);
                    if (match) setTradeMatch({ friendId: match.friendId, friendName: match.friendName, card: { cardId: c.id, name: c.name, imageSmall: c.image_small } });
                  }
                },
              },
            );
          }}
          onDecrement={c => adjustQuantity.mutate(
            { cardId: c.id, delta: -1, currentQuantity: quantities.get(c.id) ?? 0 },
            { onSuccess: () => qc.invalidateQueries({ queryKey: ['set_goal_progress', userId, setId] }) },
          )}
          onToggle={c => {
            const wasOwned = ownedAll.has(c.id);
            if (!wasOwned) {
              const completedTypes = typesCompletedByToggle(c, cards, ownedAll, typeGroups);
              const events: CaptureEvent[] = completedTypes.map(t => ({ id: `type-${t}-${c.id}`, kind: 'type', type: t }));
              if (events.length === 0) {
                const tier = classifyRarity(c.rarity);
                if (tier !== 'basic') {
                  events.push({
                    id: `rarity-${c.id}`, kind: 'rarity', tier, rarityLabel: c.rarity ?? '',
                    imageSmall: c.image_small,
                  });
                }
              }
              if (events.length > 0) setCaptureQueue(q => [...q, ...events]);
            }
            toggleOwned.mutate(
              { cardId: c.id, currentlyOwned: wasOwned, rarity: c.rarity },
              { onSuccess: () => qc.invalidateQueries({ queryKey: ['set_goal_progress', userId, setId] }) },
            );
          }}
          onToggleWish={c => {
            if (c.dex_num == null) return; // trainer/energy cards aren't tied to a Pokémon — nothing to wishlist
            toggleWish.mutate({ cardId: c.id, currentlyWished: wishedSet.has(c.id), dexNum: c.dex_num });
          }}
          onZoom={c => setZoomCard(c)}
          onOpenDetails={c => setDetailsCard(c)}
          finishesByCard={finishesByCard}
        />
      )}
      <CardZoomModal
        card={zoomCard}
        onClose={() => setZoomCard(null)}
        footer={zoomCard && ownedAll.has(zoomCard.id) ? (
          <EditCopyFooterButton onPress={() => { setDetailsCard(zoomCard); setZoomCard(null); }} />
        ) : undefined}
      />
      <CardCopySheet card={detailsCard} onClose={() => setDetailsCard(null)} />
      <CaptureEffect event={currentCapture} onDone={() => setCaptureQueue(q => q.slice(1))} />
      <TradeMatchPopup
        match={tradeMatch}
        onPropose={() => {
          if (!tradeMatch) return;
          setTradePreset({ cardId: tradeMatch.card.cardId, name: tradeMatch.card.name, imageSmall: tradeMatch.card.imageSmall });
          setTradeTarget({ id: tradeMatch.friendId, displayName: tradeMatch.friendName });
          setTradeMatch(null);
        }}
        onDismiss={() => setTradeMatch(null)}
      />
      <TradeProposalModal
        target={tradeTarget}
        onClose={() => { setTradeTarget(null); setTradePreset(undefined); }}
        initialOffered={tradePreset}
      />
    </SafeAreaView>
  );
}
