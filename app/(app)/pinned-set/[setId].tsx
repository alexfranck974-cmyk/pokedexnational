import { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CardGallery } from '@/components/CardGallery';
import { CardZoomModal } from '@/components/CardZoomModal';
import { ProgressRing } from '@/components/ProgressRing';
import { CaptureEffect, type CaptureEvent } from '@/components/CaptureEffect';
import type { TcgCardRow } from '@/lib/tcg';
import { useCardsForSet } from '@/lib/tcg';
import { useTcgSets } from '@/lib/tcg-index';
import { useSession } from '@/lib/auth';
import { useAllOwnedCardIds, useToggleOwnedCard, useOwnedCardQuantities, useAdjustOwnedCardQuantity } from '@/lib/collection';
import { useBackTo } from '@/lib/navigation';
import { currentSetTier } from '@/lib/set-tiers';
import { classifyRarity } from '@/lib/rarity-tiers';
import { buildSetTypeGroups, typesCompletedByToggle } from '@/lib/set-type-completion';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const COLUMN_CYCLE: (3 | 4 | null)[] = [null, 3, 4];

export default function PinnedSetDetail() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const router = useRouter();
  const goBack = useBackTo('/dashboard');
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: cards = [], isLoading: cardsLoading } = useCardsForSet(setId);
  const { data: ownedAll = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: allSets = [] } = useTcgSets();
  const toggleOwned = useToggleOwnedCard();
  const adjustQuantity = useAdjustOwnedCardQuantity();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [columns, setColumns] = useState<3 | 4 | null>(null);
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);
  const [captureQueue, setCaptureQueue] = useState<CaptureEvent[]>([]);
  const currentCapture = captureQueue[0] ?? null;
  const typeGroups = useMemo(() => buildSetTypeGroups(cards), [cards]);

  const set = useMemo(() => allSets.find(s => s.id === setId), [allSets, setId]);
  const setName = set?.name ?? setId ?? '';
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

  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: { padding: spacing.md, gap: spacing.sm, ...shadow.sm },
    heroTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: 'white', fontSize: 14, fontFamily: fonts.body },
    heroViewToggle: { flexDirection: 'row' as const, gap: 6 },
    viewBtn: {
      width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    viewBtnActive: { backgroundColor: 'white' },
    columnsLabel: { fontSize: 12, fontFamily: fonts.monoBold, color: 'white' },
    heroMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    heroName: { fontSize: 20, fontFamily: fonts.display, color: 'white' },
    heroCaption: { fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: 24, fontStyle: 'italic' as const },
    banner: {
      flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8,
      margin: spacing.sm, marginBottom: 0, padding: spacing.sm,
      backgroundColor: colors.primaryBg, borderRadius: radius.md,
    },
    bannerText: { flex: 1, fontSize: 11, fontFamily: fonts.body, color: colors.text, lineHeight: 15 },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={goBack} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color="white" />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>
          <View style={styles.heroViewToggle}>
            <Pressable
              onPress={() => setViewMode('grid')}
              style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}>
              <Ionicons name="grid" size={15} color={viewMode === 'grid' ? colors.primary : 'white'} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}>
              <Ionicons name="list" size={15} color={viewMode === 'list' ? colors.primary : 'white'} />
            </Pressable>
            {viewMode === 'grid' && (
              <Pressable
                onPress={() => setColumns(c => COLUMN_CYCLE[(COLUMN_CYCLE.indexOf(c) + 1) % COLUMN_CYCLE.length])}
                style={styles.viewBtn}>
                {columns ? (
                  <Text style={styles.columnsLabel}>×{columns}</Text>
                ) : (
                  <Ionicons name="grid-outline" size={15} color="white" />
                )}
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.heroMain}>
          <ProgressRing
            pct={pct} size={64} color={tier?.color ?? 'white'}
            trackColor="rgba(255,255,255,0.25)" centerLabel={`${pct}%`}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName} numberOfLines={2}>
              {tier && <Ionicons name="trophy" size={16} color={tier.color} />} {setName}
            </Text>
            <Text style={styles.heroCaption}>
              {year ? `${year} · ` : ''}{ownedCount}/{total} cartes
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.banner}>
        <Ionicons name="information-circle" size={16} color={colors.primary} />
        <Text style={styles.bannerText}>
          Cocher une carte ici l'ajoute à ta collection de cartes possédées, sans changer ta carte
          officielle du Pokédex national — rends-toi sur sa fiche pour l'utiliser comme carte officielle
          si tu le souhaites.
        </Text>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <Text style={styles.empty}>Aucune carte connue pour cette extension.</Text>
      ) : (
        <CardGallery
          cards={sortedCards}
          ownedSet={ownedAll}
          readOnly={false}
          viewMode={viewMode}
          columnsOverride={columns}
          quantities={quantities}
          onIncrement={c => adjustQuantity.mutate(
            { cardId: c.id, delta: 1, currentQuantity: quantities.get(c.id) ?? 0 },
            { onSuccess: () => qc.invalidateQueries({ queryKey: ['set_goal_progress', userId, setId] }) },
          )}
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
              { cardId: c.id, currentlyOwned: wasOwned },
              { onSuccess: () => qc.invalidateQueries({ queryKey: ['set_goal_progress', userId, setId] }) },
            );
          }}
          onZoom={c => setZoomCard(c)}
        />
      )}
      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
      <CaptureEffect event={currentCapture} onDone={() => setCaptureQueue(q => q.slice(1))} />
    </SafeAreaView>
  );
}
