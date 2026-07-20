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
          {wishFiltered.length === 0 ? (
            <Text style={styles.empty}>Aucune carte dans les extensions sélectionnées.</Text>
          ) : (
            <CardGallery
              cards={wishFiltered}
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
  screen: { flex: 1, backgroundColor: '#fafafa' },
  header: { padding: 8, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  back: { padding: 4 },
  backText: { color: '#3b82f6', fontSize: 14 },
  miniSprite: { width: 40, height: 40 },
  title: { fontSize: 16, fontWeight: '700' },
  typesRow: { marginTop: 2 },
  count: { fontSize: 12, color: '#666', paddingLeft: 4 },
  viewBtn: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: 'white' },
  viewBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  viewBtnText: { fontSize: 16, color: '#666' },
  viewBtnTextActive: { color: 'white' },
  empty: { textAlign: 'center', color: '#666', padding: 24 },
  wishBanner: { padding: 8, backgroundColor: '#fef2f2', marginHorizontal: 12, borderRadius: 6, marginBottom: 6 },
  wishBannerText: { color: '#c00', fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
