import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { TypeBadge } from '@/components/TypeBadge';
import { CardGallery } from '@/components/CardGallery';
import { useCardsForPokemon } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import { useUserCards, useToggleCard } from '@/lib/collection';

const POKEDEX = pokedexData as Pokemon[];

export default function PokemonDetail() {
  const { num: numStr } = useLocalSearchParams<{ num: string }>();
  const router = useRouter();
  const num = parseInt(numStr as string, 10);
  const p = POKEDEX.find(x => x.num === num);
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: cards = [], isLoading: cardsLoading } = useCardsForPokemon(num);
  const { data: ownedSet = new Set<string>() } = useUserCards(userId, num);
  const toggle = useToggleCard();

  if (!p) return <SafeAreaView><Text>Pokémon inconnu</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </Pressable>
        <Text style={styles.title}>#{String(p.num).padStart(4, '0')} · {getName(p)}</Text>
        <Text style={styles.count}>{ownedSet.size} / {cards.length} cartes</Text>
      </View>

      <View style={styles.hero}>
        <Image source={{ uri: p.sprite_url }} style={styles.sprite} resizeMode="contain" />
        <View style={styles.types}>
          {p.types.map(t => <TypeBadge key={t} type={t} />)}
        </View>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <Text style={styles.empty}>Aucune carte TCG connue pour ce Pokémon dans la base.</Text>
      ) : (
        <CardGallery
          cards={cards}
          ownedSet={ownedSet}
          onToggle={c => toggle.mutate({ cardId: c.id, currentlyOwned: ownedSet.has(c.id), dexNum: num })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  header: { padding: 12, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  back: { padding: 4 },
  backText: { color: '#3b82f6' },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  count: { fontSize: 12, color: '#666' },
  hero: { alignItems: 'center', padding: 16, gap: 12 },
  sprite: { width: 200, height: 200 },
  types: { flexDirection: 'row', gap: 8 },
  empty: { textAlign: 'center', color: '#666', padding: 24 },
});
