import { View, Text, StyleSheet, ActivityIndicator, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useAllWishedCards, useToggleWish } from '@/lib/collection';
import { useWindowDimensions } from 'react-native';

interface WishedCard {
  id: string;
  name: string;
  dex_num: number;
  set_id: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  image_small: string;
  image_large: string | null;
  release_date: string | null;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export default function WishlistScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: cards = [], isLoading } = useAllWishedCards(userId);
  const toggleWish = useToggleWish();
  const { width } = useWindowDimensions();

  if (isLoading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Aucune carte dans ta wishlist</Text>
        <Text style={styles.emptyHint}>Ajoute-en depuis la page détail d'un Pokémon (icône ♥).</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Wishlist</Text>
        <Text style={styles.count}>{cards.length} carte{cards.length > 1 ? 's' : ''}</Text>
      </View>
      <FlashList
        data={cards as WishedCard[]}
        numColumns={numColsFor(width)}
        estimatedItemSize={200}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/pokemon/${item.dex_num}`)}
            style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}>
            <View style={styles.imgWrap}>
              <Image source={{ uri: item.image_small }} style={styles.img} resizeMode="contain" />
              <Pressable
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleWish.mutate({ cardId: item.id, currentlyWished: true, dexNum: item.dex_num });
                }}
                style={styles.heartBtn}>
                <Text style={styles.heartFilled}>♥</Text>
              </Pressable>
            </View>
            <Text style={styles.set} numberOfLines={1}>{item.set_name} · {item.card_number}</Text>
            {item.rarity && <Text style={styles.rarity} numberOfLines={1}>{item.rarity}</Text>}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  header: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  title: { fontSize: 20, fontWeight: '700' },
  count: { fontSize: 12, color: '#666' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 14, color: '#666', textAlign: 'center' },
  tile: { flex: 1, padding: 6, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 0.72 },
  set: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  rarity: { fontSize: 10, color: '#666' },
  heartBtn: {
    position: 'absolute', top: 4, right: 4, width: 28, height: 28,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  heartFilled: { fontSize: 18, color: '#ef4444', lineHeight: 22 },
});
