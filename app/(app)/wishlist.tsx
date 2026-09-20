import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { GestureDetector } from 'react-native-gesture-handler';
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
import { CardGallery } from '@/components/CardGallery';
import type { TcgCardRow } from '@/lib/tcg';
import { CardZoomModal } from '@/components/CardZoomModal';
import { useHudDensity, HUD_DENSITY_ICON } from '@/lib/hud-density';
import { PokedexSectionTabs, sectionIndex, hrefToSection, useSectionSwipeGesture } from '@/components/PokedexSectionTabs';
import { SlideTransition } from '@/components/SlideTransition';
import { withReturnTo, safeDecodeURIComponent } from '@/lib/navigation';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { getName } from '@/lib/i18n';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { useLocale, useT } from '@/lib/locale';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import type { Pokemon, PokemonType } from '@/lib/types';
import pokedexData from '@/data/pokedex.json';

const POKEDEX = pokedexData as Pokemon[];
const TYPES_BY_DEX = new Map<number, PokemonType[]>(POKEDEX.map(p => [p.num, p.types]));
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

// Hoisted to module scope so these stay referentially identical across every
// render — an inline `{...}`/`(g) => ...` prop is a fresh object/function on
// every render, and FlashList treats that as "the list changed" and resets
// scroll to the top on relayout (maintainVisibleContentPosition is disabled
// list-wide, see e0a3635, so nothing preserves the offset through that).
const LIST_CONTENT_STYLE = { paddingBottom: TAB_BAR_CLEARANCE };
const MAINTAIN_VISIBLE_DISABLED = { disabled: true };
function dexGroupKeyExtractor(g: WishlistGroup): string { return String(g.dexNum); }

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
  // .mutate is stable across renders (react-query), unlike toggleWish itself —
  // declared this early so both the reactive `gallery` derivation below and
  // renderPokemonRow/renderCardTile's useCallback dep arrays can use it.
  const wishMutate = toggleWish.mutate;
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
  const { colors, heroGradient, heroText, heroSurface, heroSurfaceActive, heroSurfaceActiveText } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();
  const swipeGesture = useSectionSwipeGesture('wishlist');
  const { density, cycleDensity } = useHudDensity();
  const [galleryDexNum, setGalleryDexNum] = useState<number | null>(null);
  const [zoomedCardId, setZoomedCardId] = useState<string | null>(null);

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
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
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
      search: debouncedSearch, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, priceMin, priceMax, sort,
    });
    // Deliberately not folded into applyWishlistPipeline's own filter options —
    // this is a one-off view toggle off the alert pill, not a persisted/URL-driven
    // filter dimension like the others in WishlistFilterBar.
    return showAlertsOnly ? base.filter(isPriceAlertTriggered) : base;
  }, [cards, ownedIds, debouncedSearch, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, priceMin, priceMax, sort, showAlertsOnly]);

  const grouped = useMemo(() => groupWishlistByPokemon(filtered, ownedIds), [filtered, ownedIds]);

  // Derived (not stored) from the live `grouped` data, keyed only by which
  // Pokémon's gallery is open — so removing a card from inside the gallery
  // updates it immediately, and it closes itself once the group is empty,
  // instead of showing a stale snapshot from when it was opened.
  const gallery: FriendSetGalleryTarget | null = useMemo(() => {
    if (galleryDexNum == null) return null;
    const group = grouped.find(g => g.dexNum === galleryDexNum);
    if (!group) return null;
    const mon = POKEDEX_BY_DEX.get(galleryDexNum);
    return {
      setName: mon ? getName(mon, locale) : `#${String(galleryDexNum).padStart(4, '0')}`,
      owned: group.cards.filter(c => ownedIds.has(c.id)).length,
      total: group.cards.length,
      cards: group.cards.map(c => ({
        key: c.id, imageSmall: c.image_small, imageLarge: c.image_large,
        cardmarketLowEur: c.cardmarket_low_eur, cardmarketTrendEur: c.cardmarket_trend_eur,
        setId: c.set_id, setLabel: setFlagLabel(c.set_name, c.region, c.set_id),
      })),
      onRemoveCard: (cardId: string) => wishMutate({ cardId, currentlyWished: true, dexNum: galleryDexNum }),
      returnTo: '/wishlist',
    };
  }, [galleryDexNum, grouped, ownedIds, locale, wishMutate]);
  // Off the unfiltered list on purpose — a triggered card shouldn't vanish
  // from this count just because the active filters happen to hide it.
  const triggeredCount = useMemo(() => (cards as WishlistCard[]).filter(isPriceAlertTriggered).length, [cards]);

  // Derived from the live `filtered` list (not a stored snapshot) so the
  // zoom stays in sync if the underlying data changes while it's open, same
  // reasoning as `gallery` above. Tap-to-zoom on a card tile used to navigate
  // straight to the Pokémon's detail page instead — jarring when you just
  // wanted a closer look, so that's now a deliberate action (the row/chevron
  // in "pokemon" view mode still opens the gallery, unaffected).
  const zoomedCardIndex = useMemo(
    () => zoomedCardId == null ? -1 : filtered.findIndex(c => c.id === zoomedCardId),
    [zoomedCardId, filtered],
  );
  const zoomedCard = zoomedCardIndex !== -1 ? filtered[zoomedCardIndex] : null;

  // CardGallery/CardTile expect TcgCardRow — WishlistCard carries everything
  // that shape needs except release_date/series (never read by CardTile, just
  // defaulted here to satisfy the type) plus wishlist-only fields (is_priority,
  // price_alert_eur, wished_at) that TcgCardRow doesn't know about and doesn't
  // need to — those are threaded separately below, the same way ownedSet/
  // wishedSet/quantities already are for every other CardGallery caller.
  const galleryCards: TcgCardRow[] = useMemo(
    () => filtered.map(c => ({ ...c, release_date: null, series: null, region: c.region ?? 'global' })),
    [filtered],
  );
  const filteredById = useMemo(() => new Map(filtered.map(c => [c.id, c])), [filtered]);
  // Every card in this screen is wished by definition — CardTile's heart still
  // needs an explicit Set to know to render itself filled.
  const wishedIdSet = useMemo(() => new Set(filtered.map(c => c.id)), [filtered]);
  const priorityIds = useMemo(() => new Set(filtered.filter(c => c.is_priority).map(c => c.id)), [filtered]);
  const priceAlertsByCard = useMemo(() => new Map(filtered.map(c => [c.id, c.price_alert_eur ?? null])), [filtered]);
  const alertTriggeredIds = useMemo(() => new Set(filtered.filter(isPriceAlertTriggered).map(c => c.id)), [filtered]);

  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); setGeneration(null); setPriceMin(null); setPriceMax(null); };

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
    pokemonThumbWrap: { borderRadius: radius.sm, marginRight: 4, alignItems: 'center' as const, position: 'relative' as const },
    pokemonThumbWrapOwned: { borderWidth: 1.5, borderColor: colors.success },
    pokemonThumb: { width: 28, height: 40 },
    pokemonThumbRemove: {
      position: 'absolute' as const, top: -4, right: 0, width: 16, height: 16, borderRadius: 8,
      backgroundColor: colors.danger, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    pokemonThumbRemoveText: { fontSize: 9, fontFamily: fonts.bodyBold, color: 'white', lineHeight: 11 },
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
        onPress={() => setGalleryDexNum(item.dexNum)}
        style={({ pressed }) => [styles.pokemonRow, ownedCount > 0 && styles.pokemonRowOwned, pressed && { backgroundColor: colors.surfaceAlt }]}>
        <View style={styles.pokemonSpriteWrap}>
          {mon && <Image source={{ uri: mon.sprite_url }} style={styles.pokemonSprite} resizeMode="contain" />}
          {ownedCount > 0 && <View style={styles.pokemonOwnedBadge}><Pokeball size={13} /></View>}
        </View>
        <View style={styles.pokemonInfo}>
          <Text style={styles.pokemonName} numberOfLines={1}>
            #{String(item.dexNum).padStart(4, '0')} · {mon ? getName(mon, locale) : item.dexNum}
          </Text>
          {density !== 'minimal' && (
            <Text style={styles.pokemonSub}>
              {t(item.cards.length > 1 ? 'wishlist.cardsInWishlistPlural' : 'wishlist.cardsInWishlistSingular', { n: item.cards.length })}
              {ownedCount > 0 ? t(ownedCount > 1 ? 'wishlist.alreadyOwnedPlural' : 'wishlist.alreadyOwnedSingular', { n: ownedCount }) : ''}
            </Text>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pokemonThumbs}>
          {item.cards.slice(0, 4).map(c => (
            <View key={c.id} style={[styles.pokemonThumbWrap, ownedIds.has(c.id) && styles.pokemonThumbWrapOwned]}>
              <Image source={{ uri: c.image_small }} style={styles.pokemonThumb} resizeMode="contain" />
              <Pressable
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('wishlist.a11yRemove')}
                onPress={(e) => { e.stopPropagation(); wishMutate({ cardId: c.id, currentlyWished: true, dexNum: item.dexNum }); }}
                style={styles.pokemonThumbRemove}>
                <Text style={styles.pokemonThumbRemoveText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }, [ownedIds, locale, styles, colors, density]);

  // Same reasoning as renderPokemonRow above — a fresh element every render
  // reads to FlashList as a changed prop, not just re-rendered.
  const refreshControlEl = useMemo(
    () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />,
    [refreshing, onRefresh, colors.primary],
  );

  // .mutate is stable across renders (react-query), unlike togglePriority
  // itself — same useCallback-stability reasoning as wishMutate above.
  const priorityMutate = togglePriority.mutate;

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
          <Pressable
            onPress={cycleDensity}
            accessibilityRole="button"
            accessibilityLabel={t('search.a11yCycleHudDensity')}
            style={styles.viewBtn}>
            <Ionicons name={HUD_DENSITY_ICON[density]} size={15} color={density !== 'standard' ? heroSurfaceActiveText : heroText} />
          </Pressable>
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

      <GestureDetector gesture={swipeGesture} touchAction="pan-y">
      {/* userSelect:none (RNW-only — see pokemon/[num].tsx's screen style for
          the same fix) stops a swipe from becoming a native text-drag-select,
          which would otherwise eat the gesture first. */}
      <SlideTransition transitionKey={navToken} direction={sectionDirection} style={{ flex: 1, userSelect: 'none' } as any}>
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
        <CardGallery
          cards={galleryCards}
          ownedSet={ownedIds}
          wishedSet={wishedIdSet}
          primaryAction="zoom"
          onZoom={card => setZoomedCardId(card.id)}
          onToggleWish={card => wishMutate({ cardId: card.id, currentlyWished: true, dexNum: card.dex_num! })}
          priorityIds={priorityIds}
          onTogglePriority={card => {
            const wc = filteredById.get(card.id);
            if (wc) priorityMutate({ cardId: card.id, currentlyPriority: !!wc.is_priority });
          }}
          priceAlertsByCard={priceAlertsByCard}
          alertTriggeredIds={alertTriggeredIds}
          onSetPriceAlert={card => {
            const wc = filteredById.get(card.id);
            if (wc) setPriceAlertTarget(wc);
          }}
          refreshControl={refreshControlEl}
        />
      )}
      </SlideTransition>
      </GestureDetector>
      <WishlistFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        generationFilter={generationFilter} onGeneration={setGeneration}
        priceMin={priceMin} priceMax={priceMax} onPriceRange={(min, max) => { setPriceMin(min); setPriceMax(max); }}
        sort={sort} onSort={setSort}
        sets={availableSets} rarities={availableRarities}
        onReset={reset}
      />
      <FriendSetGalleryModal target={gallery} onClose={() => setGalleryDexNum(null)} />
      <CardZoomModal
        card={zoomedCard ? { image_small: zoomedCard.image_small, image_large: zoomedCard.image_large } : null}
        caption={zoomedCard ? (() => {
          const mon = POKEDEX_BY_DEX.get(zoomedCard.dex_num);
          return mon ? getName(mon, locale) : `#${String(zoomedCard.dex_num).padStart(4, '0')}`;
        })() : undefined}
        setLabel={zoomedCard ? `${setFlagLabel(zoomedCard.set_name, zoomedCard.region, zoomedCard.set_id)} · ${zoomedCard.card_number}` : undefined}
        onOpenSet={zoomedCard ? () => {
          const setId = zoomedCard.set_id;
          setZoomedCardId(null);
          router.push(withReturnTo(`/pinned-set/${setId}`, '/wishlist') as never);
        } : undefined}
        onClose={() => setZoomedCardId(null)}
        onSwipeNext={() => setZoomedCardId(id => {
          const i = id == null ? -1 : filtered.findIndex(c => c.id === id);
          return i === -1 || filtered.length === 0 ? id : filtered[(i + 1) % filtered.length].id;
        })}
        onSwipePrev={() => setZoomedCardId(id => {
          const i = id == null ? -1 : filtered.findIndex(c => c.id === id);
          return i === -1 || filtered.length === 0 ? id : filtered[(i - 1 + filtered.length) % filtered.length].id;
        })}
      />
      <PriceAlertSheet card={priceAlertTarget} onClose={() => setPriceAlertTarget(null)} />
    </SafeAreaView>
  );
}
