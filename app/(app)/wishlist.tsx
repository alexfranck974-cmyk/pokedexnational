import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useAllWishedCards, useAllOwnedCardIds, useToggleWish } from '@/lib/collection';
import {
  applyWishlistPipeline, groupWishlistByPokemon,
  type WishStatusFilter, type WishSortKey, type WishlistCard, type WishlistGroup,
} from '@/lib/wishlist-list';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';
import { getName } from '@/lib/i18n';
import type { Pokemon, PokemonType } from '@/lib/types';
import pokedexData from '@/data/pokedex.json';
import { TYPE_LABEL_FR } from '@/lib/types-colors';
import { GENERATIONS } from '@/lib/generations';

const POKEDEX = pokedexData as Pokemon[];
const TYPES_BY_DEX = new Map<number, PokemonType[]>(POKEDEX.map(p => [p.num, p.types]));
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const chipStyles = useThemedStyles((colors) => ({
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    active: { backgroundColor: colors.primary },
    text: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted },
    textActive: { color: 'white' },
  }));
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.active]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </Pressable>
  );
};

export default function WishlistScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: cards = [], isLoading } = useAllWishedCards(userId);
  const { data: ownedIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const toggleWish = useToggleWish();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<WishStatusFilter>('all');
  const [typeFilter, setType] = useState<PokemonType | null>(null);
  const [setFilter, setSet] = useState<string | null>(null);
  const [rarityFilter, setRarity] = useState<string | null>(null);
  const [generationFilter, setGeneration] = useState<number | null>(null);
  const [sort, setSort] = useState<WishSortKey>('wished-desc');
  const [viewMode, setViewMode] = useState<'cards' | 'pokemon'>('pokemon');

  const availableSets = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cards as WishlistCard[]) if (!seen.has(c.set_id)) seen.set(c.set_id, c.set_name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [cards]);

  const availableRarities = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards as WishlistCard[]) if (c.rarity) set.add(c.rarity);
    return Array.from(set).sort();
  }, [cards]);

  const filtered = useMemo(
    () => applyWishlistPipeline(cards as WishlistCard[], ownedIds, TYPES_BY_DEX, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort,
    }),
    [cards, ownedIds, search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort],
  );

  const grouped = useMemo(() => groupWishlistByPokemon(filtered, ownedIds), [filtered, ownedIds]);

  const cycleType = () => {
    const types = Object.keys(TYPE_LABEL_FR) as PokemonType[];
    const idx = typeFilter ? types.indexOf(typeFilter) : -1;
    setType(idx === types.length - 1 ? null : types[idx + 1]);
  };
  const cycleSet = () => {
    const idx = setFilter ? availableSets.findIndex(s => s.id === setFilter) : -1;
    setSet(idx === availableSets.length - 1 ? null : availableSets[idx + 1]?.id ?? null);
  };
  const cycleRarity = () => {
    const idx = rarityFilter ? availableRarities.indexOf(rarityFilter) : -1;
    setRarity(idx === availableRarities.length - 1 ? null : availableRarities[idx + 1] ?? null);
  };
  const cycleGeneration = () => {
    const idx = generationFilter ? GENERATIONS.findIndex(g => g.gen === generationFilter) : -1;
    setGeneration(idx === GENERATIONS.length - 1 ? null : GENERATIONS[idx + 1]?.gen ?? null);
  };
  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); setGeneration(null); };
  const hasFilters = statusFilter !== 'all' || typeFilter !== null || setFilter !== null || rarityFilter !== null || generationFilter !== null;

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.sm },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: spacing.md, gap: spacing.sm, ...shadow.sm,
    },
    heroTitle: { fontSize: 20, fontFamily: fonts.display, color: 'white' },
    heroRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heroCount: { fontSize: 14, fontFamily: fonts.monoBold, color: 'white' },
    heroToggle: { flexDirection: 'row' as const, gap: 6 },
    controls: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm, ...shadow.sm },
    viewBtn: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,255,255,0.18)' },
    viewBtnActive: { backgroundColor: 'white' },
    search: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, fontFamily: fonts.body, backgroundColor: colors.surfaceAlt, color: colors.text },
    chipRow: { gap: spacing.xs, alignItems: 'center' as const },
    resetBtn: { alignSelf: 'flex-end' as const, paddingVertical: 2 },
    resetText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.danger },
    emptyTitle: { fontSize: 20, fontFamily: fonts.display, textAlign: 'center' as const, color: colors.text },
    emptyHint: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    tile: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, ...shadow.sm, backgroundColor: colors.surface, margin: 4 },
    imgWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.md, padding: 2 },
    holoInner: { borderRadius: radius.md - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    img: { width: '100%' as const, aspectRatio: 0.72 },
    set: { fontSize: 12, fontFamily: fonts.bodyBold, marginTop: 4, color: colors.text },
    rarity: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted },
    pokeballOverlay: { position: 'absolute' as const, top: 4, left: 4, backgroundColor: colors.overlay, borderRadius: radius.pill, padding: 2 },
    heartBtn: {
      position: 'absolute' as const, top: 4, right: 4, width: 28, height: 28,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    pokemonRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface,
      borderLeftWidth: 3, borderLeftColor: 'transparent',
    },
    pokemonRowOwned: { borderLeftColor: colors.success },
    pokemonSpriteWrap: { width: 40, height: 40, position: 'relative' as const },
    pokemonSprite: { width: 40, height: 40 },
    pokemonOwnedBadge: {
      position: 'absolute' as const, bottom: -2, right: -2, backgroundColor: colors.surface,
      borderRadius: radius.pill, padding: 1, ...shadow.sm,
    },
    pokemonInfo: { flex: 1, gap: 2 },
    pokemonName: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    pokemonSub: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    pokemonThumbs: { maxWidth: 120, flexGrow: 0 },
    pokemonThumbWrap: { borderRadius: radius.sm, marginRight: 4 },
    pokemonThumbWrapOwned: { borderWidth: 1.5, borderColor: colors.success },
    pokemonThumb: { width: 28, height: 40 },
    heartFilled: { fontSize: 18, color: colors.danger, lineHeight: 22 },
  }));

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
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Text style={styles.heroTitle}>Wishlist</Text>
        <View style={styles.heroRight}>
          <Text style={styles.heroCount}>{filtered.length} / {cards.length}</Text>
          <View style={styles.heroToggle}>
            <Pressable
              onPress={() => setViewMode('cards')}
              style={[styles.viewBtn, viewMode === 'cards' && styles.viewBtnActive]}>
              <Ionicons name="albums" size={15} color={viewMode === 'cards' ? colors.primary : 'white'} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('pokemon')}
              style={[styles.viewBtn, viewMode === 'pokemon' && styles.viewBtnActive]}>
              <Ionicons name="list" size={15} color={viewMode === 'pokemon' ? colors.primary : 'white'} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.controls}>
        <TextInput placeholder="Rechercher (nom, set, n°)" value={search} onChangeText={setSearch}
          style={styles.search} autoCapitalize="none" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="Toutes" active={statusFilter === 'all'} onPress={() => setStatus('all')} />
          <Chip label="À acheter" active={statusFilter === 'not_owned'} onPress={() => setStatus('not_owned')} />
          <Chip label="Déjà possédée" active={statusFilter === 'owned'} onPress={() => setStatus('owned')} />
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label={generationFilter ? `Gen ${generationFilter}` : 'Génération'} active={generationFilter !== null} onPress={cycleGeneration} />
          <Chip label={typeFilter ? `Type: ${TYPE_LABEL_FR[typeFilter]}` : 'Type'} active={typeFilter !== null} onPress={cycleType} />
          <Chip label={setFilter ? `Set: ${availableSets.find(s => s.id === setFilter)?.name ?? setFilter}` : 'Set'} active={setFilter !== null} onPress={cycleSet} />
          <Chip label={rarityFilter ? `Rareté: ${rarityFilter}` : 'Rareté'} active={rarityFilter !== null} onPress={cycleRarity} />
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="♥ récent" active={sort === 'wished-desc'} onPress={() => setSort('wished-desc')} />
          <Chip label="♥ ancien" active={sort === 'wished-asc'} onPress={() => setSort('wished-asc')} />
          <Chip label="A→Z" active={sort === 'name-asc'} onPress={() => setSort('name-asc')} />
          <Chip label="Z→A" active={sort === 'name-desc'} onPress={() => setSort('name-desc')} />
          <Chip label="N° ↑" active={sort === 'num-asc'} onPress={() => setSort('num-asc')} />
          <Chip label="N° ↓" active={sort === 'num-desc'} onPress={() => setSort('num-desc')} />
        </ScrollView>

        {hasFilters && (
          <Pressable onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetText}>Réinitialiser</Text>
          </Pressable>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyHint}>Aucun résultat avec ces filtres.</Text>
        </View>
      ) : viewMode === 'pokemon' ? (
        <FlashList
          data={grouped}
          estimatedItemSize={76}
          keyExtractor={(g: WishlistGroup) => String(g.dexNum)}
          renderItem={({ item }: { item: WishlistGroup }) => {
            const mon = POKEDEX_BY_DEX.get(item.dexNum);
            const ownedCount = item.cards.filter(c => ownedIds.has(c.id)).length;
            return (
              <Pressable
                onPress={() => router.push(`/pokemon/${item.dexNum}?wishes=1`)}
                style={({ pressed }) => [styles.pokemonRow, ownedCount > 0 && styles.pokemonRowOwned, pressed && { backgroundColor: colors.surfaceAlt }]}>
                <View style={styles.pokemonSpriteWrap}>
                  {mon && <Image source={{ uri: mon.sprite_url }} style={styles.pokemonSprite} resizeMode="contain" />}
                  {ownedCount > 0 && <View style={styles.pokemonOwnedBadge}><Pokeball size={13} /></View>}
                </View>
                <View style={styles.pokemonInfo}>
                  <Text style={styles.pokemonName} numberOfLines={1}>
                    #{String(item.dexNum).padStart(4, '0')} · {mon ? getName(mon) : item.dexNum}
                  </Text>
                  <Text style={styles.pokemonSub}>
                    {item.cards.length} carte{item.cards.length > 1 ? 's' : ''} en wishlist
                    {ownedCount > 0 ? ` · ${ownedCount} déjà possédée${ownedCount > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pokemonThumbs}>
                  {item.cards.slice(0, 4).map(c => (
                    <View key={c.id} style={[styles.pokemonThumbWrap, ownedIds.has(c.id) && styles.pokemonThumbWrapOwned]}>
                      <Image source={{ uri: c.image_small }} style={styles.pokemonThumb} resizeMode="contain" />
                    </View>
                  ))}
                </ScrollView>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            );
          }}
        />
      ) : (
        <FlashList
          data={filtered}
          numColumns={numColsFor(width)}
          estimatedItemSize={200}
          keyExtractor={c => c.id}
          renderItem={({ item }) => {
            const owned = ownedIds.has(item.id);
            return (
              <Pressable
                onPress={() => router.push(`/pokemon/${item.dex_num}`)}
                style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}>
                <View style={styles.imgWrap}>
                  {owned ? (
                    <LinearGradient
                      colors={[colors.primary, colors.warning, colors.primary]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.holoBorder}>
                      <View style={styles.holoInner}>
                        <Image source={{ uri: item.image_small }} style={styles.img} resizeMode="contain" />
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.plainInner}>
                      <Image source={{ uri: item.image_small }} style={styles.img} resizeMode="contain" />
                    </View>
                  )}
                  {owned && (
                    <View style={styles.pokeballOverlay}>
                      <Pokeball size={22} />
                    </View>
                  )}
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
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
