import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { useSession } from '@/lib/auth';
import { useUserDex, useAllOwnedCardsDetailed, useAllOwnedCardsLedgerDetailed, useAllWishedCards } from '@/lib/collection';
import { useShowcase } from '@/lib/favorites';
import { useSetGoals } from '@/lib/collection-goals';
import { useTcgSets } from '@/lib/tcg-index';
import { enterPokemonDetail, withReturnTo } from '@/lib/navigation';
import { topByValue, totalCollectionValue, computeByGeneration } from '@/lib/dashboard-stats';
import { buildEvolutionFamilies } from '@/lib/evolutions';
import { suggestEvolutionGaps, suggestBinderPages, suggestByGeneration, suggestDexUpgrades } from '@/lib/suggestions';
import { PokedexHeroCard } from '@/components/PokedexHeroCard';
import { BadgesSection } from '@/components/BadgesSection';
import { SuggestionsModal } from '@/components/SuggestionsModal';
import { VitrineCarousel } from '@/components/VitrineCarousel';
import { CardZoomModal } from '@/components/CardZoomModal';
import { IconBubble } from '@/components/IconBubble';
import { SetGoalTile } from '@/components/SetGoalTile';
import { SetGoalPicker } from '@/components/SetGoalPicker';
import { useTheme, useThemedStyles, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];
const EVOLUTION_FAMILIES = buildEvolutionFamilies(POKEDEX);
const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const SUGGESTIONS_TINT = '#f472b6';
const OBJECTIVES_TINT = '#38bdf8';

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedCards = [] } = useAllOwnedCardsDetailed(userId);
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const { data: goals = [] } = useSetGoals(userId);
  const { data: allSets = [] } = useTcgSets();
  const setsById = useMemo(() => new Map(allSets.map(s => [s.id, s])), [allSets]);
  const pinnedSetIds = useMemo(() => new Set(goals.map(g => g.setId)), [goals]);

  const byGeneration = useMemo(() => computeByGeneration(POKEDEX, owned), [owned]);
  const wishedCardIds = useMemo(() => new Set(wishedCards.map((c: { id: string }) => c.id)), [wishedCards]);
  const collectionValue = useMemo(() => totalCollectionValue(ownedCards), [ownedCards]);
  const mostValuable = useMemo(() => topByValue(ownedCards, 6), [ownedCards]);

  const evolutionSuggestions = useMemo(
    () => suggestEvolutionGaps(POKEDEX, owned, EVOLUTION_FAMILIES),
    [owned],
  );
  const binderSuggestions = useMemo(() => suggestBinderPages(POKEDEX, owned, 16), [owned]);
  const generationSuggestions = useMemo(
    () => suggestByGeneration(byGeneration, POKEDEX, owned),
    [byGeneration, owned],
  );
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const ownedCardsByDex = useMemo(() => new Map(ownedCards.map(c => [c.dexNum, c])), [ownedCards]);
  const dexCardIdByDex = useMemo(
    () => new Map(Array.from(ownedCardsByDex.entries()).map(([num, c]) => [num, c.cardId])),
    [ownedCardsByDex],
  );
  const dexUpgradeSuggestions = useMemo(
    () => suggestDexUpgrades(POKEDEX, ledgerCards, dexCardIdByDex),
    [ledgerCards, dexCardIdByDex],
  );
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
  const styles = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, gap: spacing.lg },
    h1: { fontSize: 30, fontFamily: fonts.display, color: colors.text },
    collectionValue: { fontSize: 15, fontFamily: fonts.monoBold, color: colors.success },

    section: { gap: spacing.sm },
    sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    sectionTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text, flex: 1 },
    addGoalBtn: { padding: 2 },
    suggestionsRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: 14, padding: spacing.md,
    },
    suggestionsRowText: { flex: 1, fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    emptyGoalCard: {
      borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' as const, borderRadius: 14,
      padding: spacing.lg, alignItems: 'center' as const,
    },
    emptyGoalText: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Dashboard</Text>
        <Text style={styles.collectionValue}>Valeur estimée de ta collection : {eurFormatter.format(collectionValue)}</Text>

        <VitrineCarousel items={vitrineItems} />

        <PokedexHeroCard
          userId={userId}
          onSelectMissing={(dexNum) => enterPokemonDetail(router, `/pokemon/${dexNum}`, '/dashboard')}
        />

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="albums" size={15} color={OBJECTIVES_TINT} />
            </IconBubble>
            <Text style={styles.sectionTitle}>Objectifs de complétion</Text>
            <Pressable onPress={() => setGoalPickerOpen(true)} hitSlop={8} style={styles.addGoalBtn}>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </Pressable>
          </View>
          {goals.length === 0 ? (
            <Pressable onPress={() => setGoalPickerOpen(true)} style={styles.emptyGoalCard}>
              <Text style={styles.emptyGoalText}>Épingle une extension pour suivre sa progression ici.</Text>
            </Pressable>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {goals.map(g => {
                const set = setsById.get(g.setId);
                if (!set) return null;
                return (
                  <SetGoalTile
                    key={g.setId}
                    userId={userId}
                    setId={g.setId}
                    setName={set.name}
                    total={set.cardCount}
                    symbol={set.symbol}
                    onPress={() => router.push(withReturnTo(`/pinned-set/${g.setId}`, '/dashboard') as never)}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>

        <Pressable onPress={() => setSuggestionsOpen(true)} style={styles.suggestionsRow}>
          <IconBubble size={28} color={colors.primarySoft}>
            <Ionicons name="flag" size={15} color={SUGGESTIONS_TINT} />
          </IconBubble>
          <Text style={styles.suggestionsRowText}>Prochains achats</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>

        <BadgesSection
          userId={userId}
          wishedCardIds={wishedCardIds}
          wishlistCount={wishedCards.length}
        />
      </ScrollView>
      <CardZoomModal
        card={zoomCard ? { image_small: zoomCard.imageSmall, image_large: zoomCard.imageLarge } : null}
        onClose={() => setZoomIndex(null)}
        onSwipeNext={() => setZoomIndex(i => i === null ? null : (i + 1) % vitrineCards.length)}
        onSwipePrev={() => setZoomIndex(i => i === null ? null : (i - 1 + vitrineCards.length) % vitrineCards.length)}
      />
      <SetGoalPicker visible={goalPickerOpen} pinnedSetIds={pinnedSetIds} onClose={() => setGoalPickerOpen(false)} />
      <SuggestionsModal
        visible={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
        evolutionSuggestions={evolutionSuggestions}
        binderSuggestions={binderSuggestions}
        generationSuggestions={generationSuggestions}
        dexUpgradeSuggestions={dexUpgradeSuggestions}
        mostValuable={mostValuable}
        onSelectPokemon={(dexNum) => enterPokemonDetail(router, `/pokemon/${dexNum}`, '/dashboard')}
      />
    </SafeAreaView>
  );
}
