import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useAllWishedCards, useAllOwnedCardIds, useToggleWish, useToggleWishPriority } from '@/lib/collection';
import {
  applyWishlistPipeline, groupWishlistByPokemon, isPriceAlertTriggered,
  type WishStatusFilter, type WishSortKey, type WishlistCard, type WishlistGroup,
} from '@/lib/wishlist-list';
import { PriceAlertSheet } from '@/components/PriceAlertSheet';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';
import { EmptyState } from '@/components/EmptyState';
import { WishlistFilterBar } from '@/components/WishlistFilterBar';
import { RefreshButton } from '@/components/RefreshButton';
import { FriendSetGalleryModal, type FriendSetGalleryTarget } from '@/components/FriendSetGalleryModal';
import { PokedexSectionTabs, sectionIndex, hrefToSection } from '@/components/PokedexSectionTabs';
import { SlideTransition } from '@/components/SlideTransition';
import { enterPokemonDetail, safeDecodeURIComponent } from '@/lib/navigation';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { getName } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/locale';
import { formatCardPriceRange } from '@/lib/trades';
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

// Hoisted to module scope so these stay referentially identical across every
// render — an inline `{...}`/`(g) => ...` prop is a fresh object/function on
// every render, and FlashList treats that as "the list changed" and resets
// scroll to the top on relayout (maintainVisibleContentPosition is disabled
// list-wide, see e0a3635, so nothing preserves the offset through that).
const LIST_CONTENT_STYLE = { paddingBottom: TAB_BAR_CLEARANCE };
const MAINTAIN_VISIBLE_DISABLED = { disabled: true };
function dexGroupKeyExtractor(g: WishlistGroup): string { return String(g.dexNum); }
function cardKeyExtractor(c: WishlistCard): string { return c.id; }

export default function WishlistScreen() {
  const router = useRouter();
  const { from, alerts } = useLocalSearchParams<{ from?: string; alerts?: string }>();
  const { session } = useSession();
  const { locale } = useLocale();
  const t = useT();
  const userId = session?.user.id;
  const { data: cards = [], isLoading } = useAllWishedCards(userId);
  const { data: ownedIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const toggleWish = useToggleWish();
  const togglePriority = useToggleWishPriority();
  const [priceAlertTarget, setPriceAlertTarget] = useState<WishlistCard | null>(null);
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);
  // Deep link from the Dashboard's price-alerts ring — jump straight into the
  // filtered view instead of making the user find/tap the pill themselves.
  useEffect(() => {
    if (alerts !== '1') return;
    setShowAlertsOnly(true);
    router.setParams({ alerts: undefined });
  }, [alerts, router]);
  const { width } = useWindowDimensions();
  const { colors, heroGradient, heroText, heroSurface, heroSurfaceActive, heroSurfaceActiveText } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();
  const [gallery, setGallery] = useState<FriendSetGalleryTarget | null>(null);

  // Slide-in direction for arriving from Pokédex/Collection via PokedexSectionTabs
  // — see the matching effect in app/(app)/pokedex.tsx for why navToken (not the
  // raw `from` string) is what SlideTransition keys on.
  const [sectionDirection, setSectionDirection] = useState<'left' | 'right' | null>(null);
  const [navToken, setNavToken] = useState(0);
  useEffect(() => {
    if (!from) return;
    const fromSection = hrefToSection(safeDecodeURIComponent(from));
    const fromIdx = fromSection ? sectionIndex(fromSection) : null;
    const ownIdx = sectionIndex('wishlist');
    const dir: 'left' | 'right' | null = fromIdx === null || fromIdx === ownIdx ? null : fromIdx < ownIdx ? 'right' : 'left';
    setSectionDirection(dir);
    setNavToken(n => n + 1);
    router.setParams({ from: undefined });
  }, [from, router]);

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
  const filtered = useMemo(() => {
    const base = applyWishlistPipeline(cards as WishlistCard[], ownedIds, TYPES_BY_DEX, {
      search: debouncedSearch, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort,
    });
    // Deliberately not folded into applyWishlistPipeline's own filter options —
    // this is a one-off view toggle off the alert pill, not a persisted/URL-driven
    // filter dimension like the others in WishlistFilterBar.
    return showAlertsOnly ? base.filter(isPriceAlertTriggered) : base;
  }, [cards, ownedIds, debouncedSearch, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort, showAlertsOnly]);

  const grouped = useMemo(() => groupWishlistByPokemon(filtered, ownedIds), [filtered, ownedIds]);
  // Off the unfiltered list on purpose — a triggered card shouldn't vanish
  // from this count just because the active filters happen to hide it.
  const triggeredCount = useMemo(() => (cards as WishlistCard[]).filter(isPriceAlertTriggered).length, [cards]);

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
    tile: { flex: 1, padding: spacing.sm, borderRadius: radius.bubble, ...shadow.sm, backgroundColor: colors.surface, margin: 4 },
    imgWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.bubble, padding: 2 },
    holoInner: { borderRadius: radius.bubble - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.bubble, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    img: { width: '100%' as const, aspectRatio: 0.72 },
    set: { fontSize: 12, fontFamily: fonts.bodyBold, marginTop: 4, color: colors.text },
    rarity: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted },
    price: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.success },
    pokeballOverlay: { position: 'absolute' as const, top: 4, left: 4, backgroundColor: colors.overlay, borderRadius: radius.pill, padding: 2 },
    heartBtn: {
      position: 'absolute' as const, top: 4, right: 4, width: 28, height: 28,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    priorityBtn: {
      position: 'absolute' as const, bottom: 4, left: 4, width: 26, height: 26,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    alertBtn: {
      position: 'absolute' as const, bottom: 4, right: 4, width: 26, height: 26,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    alertTriggeredBadge: {
      marginTop: 2, alignSelf: 'flex-start' as const, paddingHorizontal: 6, paddingVertical: 2,
      borderRadius: radius.pill, backgroundColor: colors.success,
    },
    alertTriggeredBadgeText: { fontSize: 10, fontFamily: fonts.bodyBold, color: 'white' },
    // A compact, self-sized pill (not a full-bleed banner) — an important
    // heads-up, deliberately not the first/dominant thing on the screen.
    alertPillRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, alignItems: 'flex-start' as const },
    alertPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.successBg,
    },
    alertPillActive: { backgroundColor: colors.success },
    alertPillText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.success },
    alertPillTextActive: { color: 'white' },
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
    pokemonThumbWrap: { borderRadius: radius.sm, marginRight: 4, alignItems: 'center' as const },
    pokemonThumbWrapOwned: { borderWidth: 1.5, borderColor: colors.success },
    pokemonThumb: { width: 28, height: 40 },
    heartFilled: { fontSize: 18, color: colors.danger, lineHeight: 22 },
  }));

  // Stable across re-renders triggered by unrelated state (e.g. opening the
  // card gallery sheet) — an inline renderItem is a fresh function every
  // render, and FlashList treats that as "the list changed", re-laying out
  // and resetting scroll to the top (maintainVisibleContentPosition is
  // disabled list-wide, see e0a3635, so nothing preserves the offset through
  // that relayout). `t`'s own reference isn't a dep since its behavior is
  // fully determined by `locale`, which is.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renderPokemonRow = useCallback(({ item }: { item: WishlistGroup }) => {
    if (!item) return null;
    const mon = POKEDEX_BY_DEX.get(item.dexNum);
    const ownedCount = item.cards.filter(c => ownedIds.has(c.id)).length;
    return (
      <Pressable
        onPress={() => setGallery({
          setName: mon ? getName(mon, locale) : `#${String(item.dexNum).padStart(4, '0')}`,
          owned: ownedCount,
          total: item.cards.length,
          cards: item.cards.map(c => ({
            key: c.id, imageSmall: c.image_small, imageLarge: c.image_large,
            cardmarketLowEur: c.cardmarket_low_eur, cardmarketTrendEur: c.cardmarket_trend_eur,
          })),
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
  }, [ownedIds, locale, styles, colors]);

  // Same reasoning as renderPokemonRow above — a fresh element every render
  // reads to FlashList as a changed prop, not just re-rendered.
  const refreshControlEl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />,
    [refreshing, onRefresh, colors.primary],
  );

  // .mutate is stable across renders (react-query), unlike the toggleWish/
  // togglePriority mutation objects themselves — depending on those directly
  // would defeat this useCallback the same way an inline renderItem did.
  const wishMutate = toggleWish.mutate;
  const priorityMutate = togglePriority.mutate;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renderCardTile = useCallback(({ item }: { item: WishlistCard }) => {
    if (!item) return null;
    const owned = ownedIds.has(item.id);
    const triggered = isPriceAlertTriggered(item);
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
              wishMutate({ cardId: item.id, currentlyWished: true, dexNum: item.dex_num });
            }}
            style={styles.heartBtn}>
            <Text style={styles.heartFilled}>♥</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityLabel={t('wishlist.a11yTogglePriority')}
            onPress={(e) => {
              e.stopPropagation();
              priorityMutate({ cardId: item.id, currentlyPriority: !!item.is_priority });
            }}
            style={styles.priorityBtn}>
            <Ionicons name={item.is_priority ? 'star' : 'star-outline'} size={15} color={item.is_priority ? colors.warning : 'white'} />
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityLabel={t('wishlist.a11yPriceAlert')}
            onPress={(e) => { e.stopPropagation(); setPriceAlertTarget(item); }}
            style={styles.alertBtn}>
            <Ionicons name={item.price_alert_eur != null ? 'notifications' : 'notifications-outline'} size={15} color={triggered ? colors.success : 'white'} />
          </Pressable>
        </View>
        <Text style={styles.set} numberOfLines={1}>{item.set_name} · {item.card_number}</Text>
        {item.rarity && <Text style={styles.rarity} numberOfLines={1}>{item.rarity}</Text>}
        {formatCardPriceRange(item.cardmarket_low_eur, item.cardmarket_trend_eur, locale) != null && (
          <Text style={styles.price} numberOfLines={1}>{formatCardPriceRange(item.cardmarket_low_eur, item.cardmarket_trend_eur, locale)}</Text>
        )}
        {triggered && (
          <View style={styles.alertTriggeredBadge}>
            <Text style={styles.alertTriggeredBadgeText}>{t('wishlist.alertTriggeredBadge')}</Text>
          </View>
        )}
      </Pressable>
    );
  }, [ownedIds, locale, styles, colors, router, wishMutate, priorityMutate]);

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
          <EmptyState icon="heart-outline" title={t('wishlist.emptyTitle')} hint={t('wishlist.emptyHint')} />
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
              accessibilityRole="button"
              accessibilityLabel={t('wishlist.a11yViewCards')}
              style={[styles.viewBtn, viewMode === 'cards' && styles.viewBtnActive]}>
              <Ionicons name="albums" size={15} color={viewMode === 'cards' ? heroSurfaceActiveText : heroText} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('pokemon')}
              accessibilityRole="button"
              accessibilityLabel={t('wishlist.a11yViewPokemon')}
              style={[styles.viewBtn, viewMode === 'pokemon' && styles.viewBtnActive]}>
              <Ionicons name="list" size={15} color={viewMode === 'pokemon' ? heroSurfaceActiveText : heroText} />
            </Pressable>
          </View>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
        </View>
      </LinearGradient>

      {triggeredCount > 0 && (
        <View style={styles.alertPillRow}>
          <Pressable
            onPress={() => setShowAlertsOnly(v => !v)}
            style={[styles.alertPill, showAlertsOnly && styles.alertPillActive]}>
            <Ionicons name="notifications" size={13} color={showAlertsOnly ? 'white' : colors.success} />
            <Text style={[styles.alertPillText, showAlertsOnly && styles.alertPillTextActive]}>
              {t(triggeredCount > 1 ? 'wishlist.alertBannerPlural' : 'wishlist.alertBannerSingular', { n: triggeredCount })}
            </Text>
          </Pressable>
        </View>
      )}

      <SlideTransition transitionKey={navToken} direction={sectionDirection} style={{ flex: 1 }}>
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon="search-outline" hint={t('wishlist.noResults')} />
        </View>
      ) : viewMode === 'pokemon' ? (
        <FlashList
          data={grouped}
          contentContainerStyle={LIST_CONTENT_STYLE}
          maintainVisibleContentPosition={MAINTAIN_VISIBLE_DISABLED}
          refreshControl={refreshControlEl}
          {...hideOnScrollProps}
          keyExtractor={dexGroupKeyExtractor}
          renderItem={renderPokemonRow}
        />
      ) : (
        <FlashList
          data={filtered}
          numColumns={numColsFor(width)}
          contentContainerStyle={LIST_CONTENT_STYLE}
          maintainVisibleContentPosition={MAINTAIN_VISIBLE_DISABLED}
          refreshControl={refreshControlEl}
          {...hideOnScrollProps}
          keyExtractor={cardKeyExtractor}
          renderItem={renderCardTile}
        />
      )}
      </SlideTransition>
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
      <PriceAlertSheet card={priceAlertTarget} onClose={() => setPriceAlertTarget(null)} />
    </SafeAreaView>
  );
}
