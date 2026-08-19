import { useMemo, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
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
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';
import { WishlistFilterBar } from '@/components/WishlistFilterBar';
import { RefreshButton } from '@/components/RefreshButton';
import { FriendSetGalleryModal, type FriendSetGalleryTarget } from '@/components/FriendSetGalleryModal';
import { PokedexSectionTabs } from '@/components/PokedexSectionTabs';
import { enterPokemonDetail } from '@/lib/navigation';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { getName } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/locale';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import type { Pokemon, PokemonType } from '@/lib/types';
import pokedexData from '@/data/pokedex.json';

const POKEDEX = pokedexData as Pokemon[];
const TYPES_BY_DEX = new Map<number, PokemonType[]>(POKEDEX.map(p => [p.num, p.types]));
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export default function WishlistScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { locale } = useLocale();
  const t = useT();
  const userId = session?.user.id;
  const { data: cards = [], isLoading } = useAllWishedCards(userId);
  const { data: ownedIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const toggleWish = useToggleWish();
  const { width } = useWindowDimensions();
  const { colors, heroGradient, heroText, heroSurface, heroSurfaceActive, heroSurfaceActiveText } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();
  const [gallery, setGallery] = useState<FriendSetGalleryTarget | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState<WishStatusFilter>('all');
  const [typeFilter, setType] = useState<PokemonType | null>(null);
  const [setFilter, setSet] = useState<string | null>(null);
  const [rarityFilter, setRarity] = useState<string | null>(null);
  const [generationFilter, setGeneration] = useState<number | null>(null);
  const [sort, setSort] = useState<WishSortKey>('num-asc');
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

  // Debounced: search can shrink these FlashLists (numColumns > 1) drastically
  // on every keystroke — see lib/use-debounced-value.ts for why that's unsafe.
  const debouncedSearch = useDebouncedValue(search, 200);
  const filtered = useMemo(
    () => applyWishlistPipeline(cards as WishlistCard[], ownedIds, TYPES_BY_DEX, {
      search: debouncedSearch, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort,
    }),
    [cards, ownedIds, debouncedSearch, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort],
  );

  const grouped = useMemo(() => groupWishlistByPokemon(filtered, ownedIds), [filtered, ownedIds]);

  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); setGeneration(null); };

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.sm },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: spacing.md, gap: spacing.sm, ...shadow.sm,
    },
    heroTitle: { fontSize: 20, fontFamily: fonts.display, color: heroText },
    heroRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heroCount: { fontSize: 14, fontFamily: fonts.monoBold, color: heroText },
    heroToggle: { flexDirection: 'row' as const, gap: 6 },
    viewBtn: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: heroSurface },
    viewBtnActive: { backgroundColor: heroSurfaceActive },
    emptyTitle: { fontSize: 20, fontFamily: fonts.display, textAlign: 'center' as const, color: colors.text },
    emptyHint: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    tile: { flex: 1, padding: spacing.sm, borderRadius: radius.bubble, ...shadow.sm, backgroundColor: colors.surface, margin: 4 },
    imgWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.bubble, padding: 2 },
    holoInner: { borderRadius: radius.bubble - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.bubble, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
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
    return (
      <SafeAreaView style={styles.screen}>
        <PokedexSectionTabs active="wishlist" />
        <View style={styles.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <PokedexSectionTabs active="wishlist" />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('wishlist.emptyTitle')}</Text>
          <Text style={styles.emptyHint}>{t('wishlist.emptyHint')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <PokedexSectionTabs active="wishlist" />
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Text style={styles.heroTitle}>{t('tabs.wishlist')}</Text>
        <View style={styles.heroRight}>
          <Text style={styles.heroCount}>{filtered.length} / {cards.length}</Text>
          <View style={styles.heroToggle}>
            <Pressable
              onPress={() => setViewMode('cards')}
              style={[styles.viewBtn, viewMode === 'cards' && styles.viewBtnActive]}>
              <Ionicons name="albums" size={15} color={viewMode === 'cards' ? heroSurfaceActiveText : heroText} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('pokemon')}
              style={[styles.viewBtn, viewMode === 'pokemon' && styles.viewBtnActive]}>
              <Ionicons name="list" size={15} color={viewMode === 'pokemon' ? heroSurfaceActiveText : heroText} />
            </Pressable>
          </View>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
        </View>
      </LinearGradient>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyHint}>{t('wishlist.noResults')}</Text>
        </View>
      ) : viewMode === 'pokemon' ? (
        <FlashList
          data={grouped}
          estimatedItemSize={76}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          maintainVisibleContentPosition={{ disabled: true }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          {...hideOnScrollProps}
          keyExtractor={(g: WishlistGroup) => String(g.dexNum)}
          renderItem={({ item }: { item: WishlistGroup }) => {
            if (!item) return null;
            const mon = POKEDEX_BY_DEX.get(item.dexNum);
            const ownedCount = item.cards.filter(c => ownedIds.has(c.id)).length;
            return (
              <Pressable
                onPress={() => setGallery({
                  setName: mon ? getName(mon, locale) : `#${String(item.dexNum).padStart(4, '0')}`,
                  owned: ownedCount,
                  total: item.cards.length,
                  cards: item.cards.map(c => ({ key: c.id, imageSmall: c.image_small, imageLarge: c.image_large })),
                })}
                style={({ pressed }) => [styles.pokemonRow, ownedCount > 0 && styles.pokemonRowOwned, pressed && { backgroundColor: colors.surfaceAlt }]}>
                <View style={styles.pokemonSpriteWrap}>
                  {mon && <Image source={{ uri: mon.sprite_url }} style={styles.pokemonSprite} resizeMode="contain" />}
                  {ownedCount > 0 && <View style={styles.pokemonOwnedBadge}><Pokeball size={13} /></View>}
                </View>
                <View style={styles.pokemonInfo}>
                  <Text style={styles.pokemonName} numberOfLines={1}>
                    #{String(item.dexNum).padStart(4, '0')} · {mon ? getName(mon, locale) : item.dexNum}
                  </Text>
                  <Text style={styles.pokemonSub}>
                    {t(item.cards.length > 1 ? 'wishlist.cardsInWishlistPlural' : 'wishlist.cardsInWishlistSingular', { n: item.cards.length })}
                    {ownedCount > 0 ? t(ownedCount > 1 ? 'wishlist.alreadyOwnedPlural' : 'wishlist.alreadyOwnedSingular', { n: ownedCount }) : ''}
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
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          maintainVisibleContentPosition={{ disabled: true }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          {...hideOnScrollProps}
          keyExtractor={c => c.id}
          renderItem={({ item }) => {
            if (!item) return null;
            const owned = ownedIds.has(item.id);
            return (
              <Pressable
                onPress={() => enterPokemonDetail(router, `/pokemon/${item.dex_num}`, '/wishlist')}
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
      <WishlistFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        generationFilter={generationFilter} onGeneration={setGeneration}
        sort={sort} onSort={setSort}
        sets={availableSets} rarities={availableRarities}
        onReset={reset}
      />
      <FriendSetGalleryModal target={gallery} onClose={() => setGallery(null)} />
    </SafeAreaView>
  );
}
