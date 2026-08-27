import { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { CardGallery } from '@/components/CardGallery';
import { CardZoomModal } from '@/components/CardZoomModal';
import { CardCopySheet, EditCopyFooterButton } from '@/components/CardCopySheet';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState } from '@/components/EmptyState';
import type { TcgCardRow } from '@/lib/tcg';
import { useCardsForArtist } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import { useAllOwnedCardIds, useToggleOwnedCard, useOwnedCardQuantities, useAdjustOwnedCardQuantity, useAllWishedCards, useToggleWish, useOwnedCardFinishes } from '@/lib/collection';
import { useBackTo } from '@/lib/navigation';
import { useHistoryBackGuard } from '@/lib/history-back-guard';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const COLUMN_CYCLE: (3 | 4 | null)[] = [null, 3, 4];

// Browsing an illustrator's full body of work — every card by them, owned or
// not (mirrors the "Extensions" catalog's discovery angle), reached from the
// Collection "Artistes" tab or the Stats "Artistes" breakdown. No pin/goal
// concept here (unlike sets): the owned/total ring is just descriptive.
export default function ArtistGallery() {
  const { artist: artistParam } = useLocalSearchParams<{ artist: string }>();
  const artist = decodeURIComponent(artistParam ?? '');
  const goBack = useBackTo('/favorites');

  useHistoryBackGuard(goBack);

  const { session } = useSession();
  const userId = session?.user.id;

  const { data: cards = [], isLoading: cardsLoading } = useCardsForArtist(artist);
  const { data: ownedAll = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: finishesByCard } = useOwnedCardFinishes(userId);
  const toggleOwned = useToggleOwnedCard();
  const adjustQuantity = useAdjustOwnedCardQuantity();
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const wishedSet = useMemo(() => new Set(wishedCards.map(c => c.id)), [wishedCards]);
  const toggleWish = useToggleWish();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [columns, setColumns] = useState<3 | 4 | null>(null);
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);
  const [detailsCard, setDetailsCard] = useState<TcgCardRow | null>(null);

  const ownedCount = useMemo(() => cards.filter(c => ownedAll.has(c.id)).length, [cards, ownedAll]);
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '')),
    [cards],
  );
  const pct = cards.length > 0 ? Math.round((ownedCount / cards.length) * 100) : 0;

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
    heroName: { fontSize: 20, fontFamily: fonts.display, color: heroText },
    heroCaption: { fontSize: 12, fontFamily: fonts.mono, color: heroTextMuted, marginTop: 2 },
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
        <View style={styles.heroMain}>
          <ProgressRing pct={pct} size={64} color={heroSurfaceActive} trackColor={heroTrack} centerLabel={`${pct}%`} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName} numberOfLines={2}>{artist}</Text>
            <Text style={styles.heroCaption}>{ownedCount}/{cards.length} cartes</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.banner}>
        <Ionicons name="information-circle" size={16} color={colors.primary} />
        <Text style={styles.bannerText}>
          Cocher une carte ici l'ajoute à ta collection de cartes possédées, sans changer ta carte
          choisie du Pokédex national.
        </Text>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <EmptyState icon="brush-outline" hint="Aucune carte connue pour cet artiste." />
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
            adjustQuantity.mutate({ cardId: c.id, delta: 1, currentQuantity, rarity: c.rarity });
          }}
          onDecrement={c => adjustQuantity.mutate({ cardId: c.id, delta: -1, currentQuantity: quantities.get(c.id) ?? 0 })}
          onToggle={c => toggleOwned.mutate({ cardId: c.id, currentlyOwned: ownedAll.has(c.id), rarity: c.rarity })}
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
    </SafeAreaView>
  );
}
