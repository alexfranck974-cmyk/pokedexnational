import { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import { useMotion } from '@/lib/motion';
import { withReturnTo } from '@/lib/navigation';
import type { StringKey } from '@/lib/strings';

export type PokedexSection = 'pokedex' | 'collection' | 'wishlist';

const SECTIONS: { key: PokedexSection; labelKey: StringKey; href: '/pokedex' | '/favorites' | '/wishlist' }[] = [
  { key: 'pokedex', labelKey: 'tabs.pokedex', href: '/pokedex' },
  { key: 'collection', labelKey: 'tabs.collection', href: '/favorites' },
  { key: 'wishlist', labelKey: 'tabs.wishlist', href: '/wishlist' },
];

// Pure index/lookup helpers so the three section screens can compute a slide
// direction from the `from` param below without duplicating SECTIONS' order.
export function sectionIndex(key: PokedexSection): number {
  return SECTIONS.findIndex(s => s.key === key);
}
export function hrefToSection(href: string): PokedexSection | null {
  return SECTIONS.find(s => s.href === href)?.key ?? null;
}

interface Props {
  active: PokedexSection;
}

// Real navigation (router.replace) between three sibling routes, not local
// component-swap state — so every existing from/fallback string pointing at
// /pokedex, /favorites or /wishlist (useBackTo, enterPokemonDetail, ...)
// keeps working unchanged, and returning from a pushed detail screen lands
// back on the exact section it was opened from.
export function PokedexSectionTabs({ active }: Props) {
  const router = useRouter();
  const t = useT();
  const { animationsEnabled } = useMotion();
  const activeIndex = sectionIndex(active);

  // Measured (not percentage-based) so the sliding pill lines up exactly with
  // the flex:1 tab buttons regardless of screen width — recomputed on layout/
  // rotation via onLayout rather than assumed from window dimensions.
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    if (!animationsEnabled) { indicatorAnim.setValue(activeIndex); return; }
    Animated.spring(indicatorAnim, { toValue: activeIndex, useNativeDriver: false, bounciness: 6 }).start();
    // useNativeDriver: false — this animates `left`/`width` (layout
    // properties), which the native driver can't touch, only transform/opacity.
  }, [activeIndex, animationsEnabled, indicatorAnim]);

  const tabWidth = rowWidth / SECTIONS.length;
  const indicatorLeft = indicatorAnim.interpolate({
    inputRange: SECTIONS.map((_, i) => i),
    outputRange: SECTIONS.map((_, i) => i * tabWidth),
  });

  const onRowLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width);

  const styles = useThemedStyles((colors) => ({
    // No border/background seam of its own anymore — sits flush against the
    // header above it (colors.bg matches the screen background) instead of
    // reading as a separate strip.
    row: { flexDirection: 'row' as const, padding: spacing.sm, position: 'relative' as const, backgroundColor: colors.bg },
    indicator: { position: 'absolute' as const, top: spacing.sm, bottom: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
    tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' as const },
    tabText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    tabTextActive: { color: 'white' },
  }));

  return (
    <View style={styles.row} onLayout={onRowLayout}>
      {rowWidth > 0 && (
        <Animated.View pointerEvents="none" style={[styles.indicator, { left: indicatorLeft, width: tabWidth }]} />
      )}
      {SECTIONS.map(s => (
        <Pressable
          key={s.key}
          onPress={() => {
            if (s.key === active) return;
            const originHref = SECTIONS.find(sec => sec.key === active)?.href ?? '/pokedex';
            router.replace(withReturnTo(s.href, originHref) as never);
          }}
          style={styles.tabBtn}>
          <Text style={[styles.tabText, s.key === active && styles.tabTextActive]}>{t(s.labelKey)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
