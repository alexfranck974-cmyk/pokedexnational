import { useMemo, type ReactElement } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions, type RefreshControlProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { PokemonTile } from './PokemonTile';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import type { PokemonWithState } from '@/lib/pokedex-list';
import { GENERATIONS, GEN_COLORS, GEN_STARTERS, getGenerationLabel } from '@/lib/generations';
import { withAlpha } from '@/lib/color-utils';
import { useLocale } from '@/lib/locale';
import { useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';

const POKEDEX = pokedexData as Pokemon[];
const SPRITE_BY_DEX = new Map<number, string>(POKEDEX.map(p => [p.num, p.sprite_url]));

interface Props {
  items: PokemonWithState[];
  ownedImages?: Map<number, string>;
  wishedInDexSet?: Set<number>;
  /** dex_num -> cardmarket trend price of the owned official card — only pass
   * this when the value toggle is on, so tiles fall back to the (unrelated)
   * cardCount slot otherwise. */
  cardPrices?: Map<number, number | null>;
  columnsOverride?: 2 | 3 | 4 | null;
  /** Scrolls together with the grid instead of sitting in a fixed header above it. */
  ListHeaderComponent?: ReactElement | null;
  refreshControl?: ReactElement<RefreshControlProps>;
  onSelect: (num: number) => void;
  onLongSelect?: (num: number) => void;
}

type GridRow =
  | { type: 'header'; key: string; gen: number; label: string; owned: number; total: number }
  | { type: 'pokemon'; key: string; item: PokemonWithState };

// Per-generation colored glow on the starter sprites — dynamic per row, so it
// can't live in the static useThemedStyles factory below (that only reruns
// on theme change, not per generation).
function shadowGlow(color: string) {
  return {
    shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 5,
    elevation: 4,
  };
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

export function PokedexGrid({ items, ownedImages, wishedInDexSet, cardPrices, columnsOverride, ListHeaderComponent, refreshControl, onSelect, onLongSelect }: Props) {
  const { width } = useWindowDimensions();
  const { locale } = useLocale();
  const hideOnScrollProps = useHideOnScrollProps();
  const cols = columnsOverride ?? numColsFor(width);
  const styles = useThemedStyles((colors) => ({
    headerRow: {
      alignItems: 'center' as const, justifyContent: 'center' as const,
      paddingVertical: spacing.sm, backgroundColor: colors.bg,
    },
    headerPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: spacing.md, paddingVertical: 5,
      borderRadius: radius.pill, borderWidth: 1.5, overflow: 'hidden' as const,
    },
    starterCluster: { flexDirection: 'row' as const },
    starterBubble: {
      width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5, borderColor: colors.bg, overflow: 'hidden' as const,
    },
    starterBubbleOverlap: { marginLeft: -9 },
    starterImg: { width: '100%' as const, height: '100%' as const },
    headerLabel: { fontSize: 12, fontFamily: fonts.display, color: colors.text },
    headerCount: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted },
  }));

  const rows = useMemo(() => {
    const result: GridRow[] = [];
    for (const gen of GENERATIONS) {
      const bucket = items.filter(p => p.num >= gen.min && p.num <= gen.max);
      if (bucket.length === 0) continue;
      const owned = bucket.filter(p => p.owned).length;
      result.push({ type: 'header', key: `header-${gen.gen}`, gen: gen.gen, label: getGenerationLabel(gen, locale), owned, total: bucket.length });
      for (const item of bucket) result.push({ type: 'pokemon', key: String(item.num), item });
    }
    return result;
  }, [items, locale]);

  const stickyHeaderIndices = useMemo(
    () => rows.reduce<number[]>((acc, row, i) => { if (row.type === 'header') acc.push(i); return acc; }, []),
    [rows],
  );

  return (
    <FlashList
      data={rows}
      numColumns={cols}
      keyExtractor={row => row?.key ?? 'missing'}
      getItemType={row => row?.type ?? 'pokemon'}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={refreshControl}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      maintainVisibleContentPosition={{ disabled: true }}
      stickyHeaderIndices={stickyHeaderIndices}
      {...hideOnScrollProps}
      overrideItemLayout={(layout, row, _index, maxColumns) => {
        if (row?.type === 'header') layout.span = maxColumns;
      }}
      renderItem={({ item: row }) =>
        !row ? null :
        row.type === 'header' ? (
          <View style={styles.headerRow}>
            <View style={[styles.headerPill, { borderColor: GEN_COLORS[row.gen] ?? '#888888' }]}>
              <LinearGradient
                colors={[withAlpha(GEN_COLORS[row.gen] ?? '#888888', 0.32), withAlpha(GEN_COLORS[row.gen] ?? '#888888', 0.08)]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.starterCluster}>
                {(GEN_STARTERS[row.gen] ?? []).map((dexNum, i) => (
                  <View
                    key={dexNum}
                    style={[
                      styles.starterBubble, i > 0 && styles.starterBubbleOverlap,
                      shadowGlow(GEN_COLORS[row.gen] ?? '#888888'),
                    ]}>
                    <Image source={{ uri: SPRITE_BY_DEX.get(dexNum) }} style={styles.starterImg} resizeMode="contain" />
                  </View>
                ))}
              </View>
              <Text style={styles.headerLabel}>{row.label}</Text>
              <Text style={styles.headerCount}>{row.owned}/{row.total}</Text>
            </View>
          </View>
        ) : (
          <PokemonTile
            pokemon={row.item}
            owned={row.item.owned}
            collected={row.item.collected}
            ownedCardImage={ownedImages?.get(row.item.num)}
            priceEur={cardPrices?.get(row.item.num)}
            wishedInDex={wishedInDexSet?.has(row.item.num)}
            onPress={() => onSelect(row.item.num)}
            onZoom={onLongSelect ? () => onLongSelect(row.item.num) : undefined}
          />
        )
      }
    />
  );
}
