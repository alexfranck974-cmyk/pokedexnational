import { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { TypeBadge } from '@/components/TypeBadge';
import { CardGallery } from '@/components/CardGallery';
import { CardFilterTree } from '@/components/CardFilterTree';
import { useCardsForPokemon } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import { useUserCards, useUserWishlist, useToggleCard, useToggleWish } from '@/lib/collection';
import { colors, radius, spacing, shadow } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

export default function PokemonDetail() {
  const { num: numStr, wishes } = useLocalSearchParams<{ num: string; wishes?: string }>();
  const router = useRouter();
  const num = parseInt(numStr as string, 10);
  const p = POKEDEX.find(x => x.num === num);
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: cards = [], isLoading: cardsLoading } = useCardsForPokemon(num);
  const { data: ownedSet = new Set<string>() } = useUserCards(userId, num);
  const { data: wishedSet = new Set<string>() } = useUserWishlist(userId, num);
  const toggle = useToggleCard();
  const toggleWish = useToggleWish();

  const [selectedSetIds, setSelectedSetIds] = useState<Set<string> | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onlyWishes, setOnlyWishes] = useState(wishes === '1');

  const filteredCards = useMemo(
    () => selectedSetIds === null ? cards : cards.filter(c => selectedSetIds.has(c.set_id)),
    [cards, selectedSetIds],
  );

  const wishFiltered = onlyWishes ? filteredCards.filter(c => wishedSet.has(c.id)) : filteredCards;

  const sortedCards = useMemo(() => {
    const wished: typeof wishFiltered = [];
    const rest: typeof wishFiltered = [];
    for (const c of wishFiltered) {
      if (wishedSet.has(c.id)) wished.push(c);
      else rest.push(c);
    }
    return [...wished, ...rest];
  }, [wishFiltered, wishedSet]);

  if (!p) return <SafeAreaView><Text>Pokémon inconnu</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </Pressable>
        <Image source={{ uri: p.sprite_url }} style={styles.miniSprite} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>#{String(p.num).padStart(4, '0')} · {getName(p)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesRow} contentContainerStyle={{ gap: 6 }}>
            {p.types.map(t => <TypeBadge key={t} type={t} />)}
          </ScrollView>
        </View>
        <Text style={styles.count}>{ownedSet.size} / {filteredCards.length}</Text>
        <Pressable
          onPress={() => setViewMode('grid')}
          style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}>
          <Text style={[styles.viewBtnText, viewMode === 'grid' && styles.viewBtnTextActive]}>⊞</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('list')}
          style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}>
          <Text style={[styles.viewBtnText, viewMode === 'list' && styles.viewBtnTextActive]}>☰</Text>
        </Pressable>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <Text style={styles.empty}>Aucune carte TCG connue pour ce Pokémon dans la base.</Text>
      ) : (
        <>
          <CardFilterTree
            cards={cards}
            selectedSetIds={selectedSetIds}
            onChange={setSelectedSetIds}
          />
          {onlyWishes && (
            <Pressable onPress={() => setOnlyWishes(false)} style={styles.wishBanner}>
              <Text style={styles.wishBannerText}>♥ Filtre wish actif — tap pour tout voir</Text>
            </Pressable>
          )}
          {sortedCards.length === 0 ? (
            <Text style={styles.empty}>Aucune carte dans les extensions sélectionnées.</Text>
          ) : (
            <CardGallery
              cards={sortedCards}
              ownedSet={ownedSet}
              wishedSet={wishedSet}
              viewMode={viewMode}
              onToggle={c => toggle.mutate({ cardId: c.id, currentlyOwned: ownedSet.has(c.id), dexNum: num, imageSmall: c.image_small })}
              onToggleWish={c => toggleWish.mutate({ cardId: c.id, currentlyWished: wishedSet.has(c.id), dexNum: num })}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8, ...shadow.sm },
  back: { padding: 4 },
  backText: { color: colors.primary, fontSize: 14 },
  miniSprite: { width: 40, height: 40 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  typesRow: { marginTop: 2 },
  count: { fontSize: 12, color: colors.textMuted, paddingLeft: 4 },
  viewBtn: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  viewBtnActive: { backgroundColor: colors.primary },
  viewBtnText: { fontSize: 16, color: colors.textMuted },
  viewBtnTextActive: { color: 'white' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: 24, fontStyle: 'italic' },
  wishBanner: { padding: spacing.sm, backgroundColor: colors.dangerBg, marginHorizontal: spacing.md, borderRadius: radius.md, marginBottom: 6 },
  wishBannerText: { color: colors.danger, fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
