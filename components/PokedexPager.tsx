import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PokemonTile } from './PokemonTile';
import type { PokemonWithState } from '@/lib/pokedex-list';
import { BINDER_LAYOUT_COLS, type BinderLayout } from '@/lib/binders';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';

interface Props {
  items: PokemonWithState[];
  pageLayout: 9 | 12 | 16;
  ownedImages?: Map<number, string>;
  wishedInDexSet?: Set<number>;
  cardPrices?: Map<number, number | null>;
  onSelect: (num: number) => void;
  onLongSelect?: (num: number) => void;
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
export function PokedexPager({ items, pageLayout, ownedImages, wishedInDexSet, cardPrices, onSelect, onLongSelect }: Props) {
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

  const goToPage = (i: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, i));
    setPageIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const styles = useThemedStyles((colors, shadow) => ({
    page: { justifyContent: 'center' as const, padding: spacing.md },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const },
    slot: { padding: 6 },
    navBtn: {
      position: 'absolute' as const, top: '50%' as const, marginTop: -22, width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: 0.92, ...shadow.md,
    },
    navBtnLeft: { left: spacing.sm },
    // Clears SearchFilterBar's right-edge FAB stack (search/filter/columns/
    // values/viewMode, ~52px wide + spacing.lg inset) — sitting under
    // spacing.sm like the binder viewer's arrow does would collide with it,
    // since this screen (unlike the binder viewer) also renders that overlay.
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

      {pageCount > 1 && (
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
      <View style={styles.pageBadge} pointerEvents="none">
        <Text style={styles.pageBadgeText}>{pageIndex + 1}/{pageCount}</Text>
      </View>
    </View>
  );
}
