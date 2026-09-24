import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PokemonTile } from './PokemonTile';
import type { PokemonWithState } from '@/lib/pokedex-list';
import { BINDER_LAYOUT_COLS, type BinderLayout } from '@/lib/binders';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { PAGE_TOOLBAR_HEIGHT } from './SearchFilterBar';

interface Props {
  items: PokemonWithState[];
  pageLayout: 9 | 12 | 16;
  ownedImages?: Map<number, string>;
  wishedInDexSet?: Set<number>;
  cardPrices?: Map<number, number | null>;
  onSelect: (num: number) => void;
  onLongSelect?: (num: number) => void;
  /** Hides the page-turn arrows + page-count badge for a chrome-free
   * "contemplation" reading mode — tapping anywhere on the page (outside a
   * tile) calls onBackgroundPress to bring them back. Omit/true for the
   * normal always-visible controls. */
  chromeVisible?: boolean;
  onBackgroundPress?: () => void;
}

// Binder-style paged view over the *whole* filtered/sorted dex, continuous
// (no per-generation split — same order as scroll mode, just chunked).
// Modeled directly on app/(app)/binder/[binderId].tsx's page-turn mechanism
// (plain Animated.ScrollView, pagingEnabled, one continuous scrollX driving
// per-page rotateY/scale/opacity) — that screen mounts every page's grid
// simultaneously, fine for a binder's bounded size. At up to 1025/9 ≈ 114
// pages that's not viable here, so only pageIndex±1 render their real grid;
// everything else is an empty width-only placeholder (keeps pagingEnabled's
// scroll math correct without mounting hundreds of tile grids at once).
export function PokedexPager({ items, pageLayout, ownedImages, wishedInDexSet, cardPrices, onSelect, onLongSelect, chromeVisible = true, onBackgroundPress }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const cols = BINDER_LAYOUT_COLS[pageLayout as BinderLayout];

  const [pageIndex, setPageIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const pageCount = Math.max(1, Math.ceil(items.length / pageLayout));
  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, page) => items.slice(page * pageLayout, page * pageLayout + pageLayout)),
    [items, pageCount, pageLayout],
  );

  // A filter/search/sort change (new `items`) or a layout cycle (3x3/4x3/4x4,
  // changing how many items fit per page) can both shrink `pageCount` or
  // reshuffle what page N means. Without this, the ScrollView's native scroll
  // offset stays at the old pageIndex*width — past the new (shorter) content
  // width when pageCount shrank, which reads as a swipe "stuck" past the last
  // real page (blank page, can't swipe back to content without first swiping
  // forward into the clamped void and back). Re-sync whenever the makeup of
  // pages changes under the user, not just on mount.
  useEffect(() => {
    setPageIndex(i => {
      const clamped = Math.max(0, Math.min(pageCount - 1, i));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: false });
      return clamped;
    });
  }, [pageCount, pageLayout, width]);

  const goToPage = (i: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, i));
    setPageIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const styles = useThemedStyles((colors, shadow) => ({
    // paddingTop clears SearchFilterBar's page-mode top toolbar (this
    // component only ever renders in page mode, so it's unconditional here).
    page: { justifyContent: 'center' as const, padding: spacing.md, paddingTop: spacing.md + PAGE_TOOLBAR_HEIGHT },
    // Absolutely-positioned sibling of the grid, not a flex-wrapping parent
    // around it — confirmed live 2026-09-24 that wrapping the grid in a
    // Pressable here broke BOTH swipe-to-turn-the-page and the tap itself on
    // web: `styles.page` has no explicit height (sized by the horizontal
    // pagingEnabled ScrollView's own scroll-snap machinery), so a flex:1
    // child collapsed to the grid's own content size instead of the full
    // page, and nesting inside a paging ScrollView's content changed its
    // touch/responder negotiation for swipes too. As an absolute `inset:0`
    // sibling instead, it resolves against the nearest ancestor that DOES
    // have a real size (the ScrollView itself) regardless of `page`'s own
    // auto height, and doesn't sit in the swipe gesture's path at all. Given
    // BEFORE the grid in JSX (not after), so the grid's own tile Pressables
    // — later siblings, painted on top — still win hit-testing wherever a
    // tile actually covers; this one only ever receives a tap that lands on
    // truly empty page space.
    backgroundPress: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const },
    slot: { padding: 6 },
    // Bottom row (same height as pageBadge below, flanking it left/right)
    // instead of vertically centered over the grid — centered arrows sat on
    // top of the middle row of Pokémon tiles, right where thumbs naturally
    // rest, so they were blocking the view they were meant to help navigate.
    // This band is NOT clear on the sides though: app/(app)/_layout.tsx's
    // GlobalSearchBubble/more-actions FABs are pinned at the same height on
    // both edges (bottom: fabSlot(0) = 94, ~44px wide) on every screen —
    // confirmed live 2026-09-19, the right arrow rendered directly under the
    // global search bubble at spacing.sm. 76px clears both (matches the
    // inset this component's right arrow already used before it lived in
    // this band, now needed on the left arrow too).
    navBtn: {
      position: 'absolute' as const, bottom: TAB_BAR_CLEARANCE, width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: 0.92, ...shadow.md,
    },
    navBtnLeft: { left: 76 },
    navBtnRight: { right: 76 },
    // Clears the floating tab bar (same TAB_BAR_CLEARANCE the FlashList grid
    // uses as contentContainerStyle padding) — sitting at spacing.md like the
    // binder viewer's badge does would land underneath it on this screen.
    pageBadge: {
      position: 'absolute' as const, bottom: TAB_BAR_CLEARANCE, alignSelf: 'center' as const,
      backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4,
    },
    pageBadgeText: { fontSize: 12, fontFamily: fonts.mono, color: colors.text },
  }));

  const pageContentWidth = width - spacing.md * 2;
  const slotWidth = pageContentWidth / cols - 12;

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}>
        {pages.map((pageItems, page) => {
          const windowed = Math.abs(page - pageIndex) <= 1;
          if (!windowed) return <View key={page} style={{ width }} />;

          const inputRange = [(page - 1) * width, page * width, (page + 1) * width];
          const rotateY = scrollX.interpolate({ inputRange, outputRange: ['12deg', '0deg', '-12deg'], extrapolate: 'clamp' });
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.75, 1, 0.75], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={page}
              style={[styles.page, { width, opacity, transform: [{ perspective: 800 }, { rotateY }, { scale }] }]}>
              <Pressable style={styles.backgroundPress} onPress={onBackgroundPress} />
              <View style={styles.grid}>
                {pageItems.map(item => (
                  <View key={item.num} style={[styles.slot, { width: slotWidth + 12 }]}>
                    <PokemonTile
                      pokemon={item}
                      owned={item.owned}
                      collected={item.collected}
                      ownedCardImage={ownedImages?.get(item.num)}
                      priceEur={cardPrices?.get(item.num)}
                      wishedInDex={wishedInDexSet?.has(item.num)}
                      onPress={() => onSelect(item.num)}
                      onZoom={onLongSelect ? () => onLongSelect(item.num) : undefined}
                    />
                  </View>
                ))}
              </View>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {chromeVisible && pageCount > 1 && (
        <>
          {pageIndex > 0 && (
            <Pressable onPress={() => goToPage(pageIndex - 1)} style={[styles.navBtn, styles.navBtnLeft]} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          )}
          {pageIndex < pageCount - 1 && (
            <Pressable onPress={() => goToPage(pageIndex + 1)} style={[styles.navBtn, styles.navBtnRight]} hitSlop={8}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          )}
        </>
      )}
      {chromeVisible && (
        <View style={styles.pageBadge} pointerEvents="none">
          <Text style={styles.pageBadgeText}>{pageIndex + 1}/{pageCount}</Text>
        </View>
      )}
    </View>
  );
}
