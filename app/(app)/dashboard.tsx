import { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { useSession } from '@/lib/auth';
import { useUserDex, useAllOwnedCardsDetailed, useAllWishedCards } from '@/lib/collection';
import { useShowcase } from '@/lib/favorites';
import { enterPokemonDetail } from '@/lib/navigation';
import { topByValue, totalCollectionValue, computeByGeneration } from '@/lib/dashboard-stats';
import { buildEvolutionFamilies } from '@/lib/evolutions';
import { suggestEvolutionGaps, suggestBinderPages, suggestByGeneration } from '@/lib/suggestions';
import { PokedexStatsSection } from '@/components/PokedexStatsSection';
import { ShowcaseRow } from '@/components/ShowcaseRow';
import { VitrineCarousel } from '@/components/VitrineCarousel';
import { CardZoomModal } from '@/components/CardZoomModal';
import { IconBubble } from '@/components/IconBubble';
import { useTheme, useThemedStyles, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];
const EVOLUTION_FAMILIES = buildEvolutionFamilies(POKEDEX);
const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const SUGGESTIONS_TINT = '#f472b6';

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedCards = [] } = useAllOwnedCardsDetailed(userId);
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const { data: wishedCards = [] } = useAllWishedCards(userId);

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
    sectionTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Dashboard</Text>
        <Text style={styles.collectionValue}>Valeur estimée de ta collection : {eurFormatter.format(collectionValue)}</Text>

        <VitrineCarousel items={vitrineItems} />

        <PokedexStatsSection
          userId={userId}
          wishedCardIds={wishedCardIds}
          wishlistCount={wishedCards.length}
          onSelectMissing={(dexNum) => enterPokemonDetail(router, `/pokemon/${dexNum}`)}
        />

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="flag" size={15} color={SUGGESTIONS_TINT} />
            </IconBubble>
            <Text style={styles.sectionTitle}>Prochaines cartes à obtenir</Text>
          </View>
          <ShowcaseRow
            title="Compléter une ligne évolutive"
            items={evolutionSuggestions.map(s => ({
              key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
              onPress: () => enterPokemonDetail(router, `/pokemon/${s.num}`),
            }))}
            emptyHint="Toutes tes lignes évolutives possédées sont complètes !"
          />
          <ShowcaseRow
            title="Finir une page de classeur (4×4)"
            items={binderSuggestions.map(s => ({
              key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
              onPress: () => enterPokemonDetail(router, `/pokemon/${s.num}`),
            }))}
            emptyHint="Aucune page en cours de complétion pour l’instant."
          />
          <ShowcaseRow
            title="Génération prioritaire"
            items={generationSuggestions.map(s => ({
              key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
              onPress: () => enterPokemonDetail(router, `/pokemon/${s.num}`),
            }))}
            emptyHint="Bravo, toutes les générations sont complètes !"
          />
        </View>

        <ShowcaseRow
          title="Tes cartes les plus chères"
          items={mostValuable.map(c => ({
            key: c.cardId,
            image: c.imageSmall,
            label: c.name,
            caption: c.cardmarketTrendEur !== null ? eurFormatter.format(c.cardmarketTrendEur) : undefined,
            onPress: () => enterPokemonDetail(router, `/pokemon/${c.dexNum}`),
          }))}
          emptyHint="Aucune carte avec un prix connu pour l’instant."
        />
      </ScrollView>
      <CardZoomModal
        card={zoomCard ? { image_small: zoomCard.imageSmall, image_large: zoomCard.imageLarge } : null}
        onClose={() => setZoomIndex(null)}
        onSwipeNext={() => setZoomIndex(i => i === null ? null : (i + 1) % vitrineCards.length)}
        onSwipePrev={() => setZoomIndex(i => i === null ? null : (i - 1 + vitrineCards.length) % vitrineCards.length)}
      />
    </SafeAreaView>
  );
}
