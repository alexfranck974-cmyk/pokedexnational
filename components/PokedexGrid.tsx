import { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PokemonTile } from './PokemonTile';
import type { PokemonWithState } from '@/lib/pokedex-list';
import { GENERATIONS, GEN_COLORS, GEN_EMOJI } from '@/lib/generations';
import { withAlpha } from '@/lib/color-utils';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  items: PokemonWithState[];
  ownedImages?: Map<number, string>;
  wishedInDexSet?: Set<number>;
  columnsOverride?: 2 | 3 | 4 | null;
  onSelect: (num: number) => void;
  onDoubleSelect?: (num: number) => void;
}

type GridRow =
  | { type: 'header'; key: string; gen: number; label: string; owned: number; total: number }
  | { type: 'pokemon'; key: string; item: PokemonWithState };

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

export function PokedexGrid({ items, ownedImages, wishedInDexSet, columnsOverride, onSelect, onDoubleSelect }: Props) {
  const { width } = useWindowDimensions();
  const cols = columnsOverride ?? numColsFor(width);
  const styles = useThemedStyles((colors) => ({
    headerRow: {
      alignItems: 'center' as const, justifyContent: 'center' as const,
      paddingVertical: spacing.sm, backgroundColor: colors.bg,
    },
    headerPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: spacing.md, paddingVertical: 5,
      borderRadius: radius.pill, borderWidth: 1.5,
    },
    headerEmoji: { fontSize: 12 },
    headerLabel: { fontSize: 12, fontFamily: fonts.display, color: colors.text },
    headerCount: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted },
  }));

  const rows = useMemo(() => {
    const result: GridRow[] = [];
    for (const gen of GENERATIONS) {
      const bucket = items.filter(p => p.num >= gen.min && p.num <= gen.max);
      if (bucket.length === 0) continue;
      const owned = bucket.filter(p => p.owned).length;
      result.push({ type: 'header', key: `header-${gen.gen}`, gen: gen.gen, label: gen.label, owned, total: bucket.length });
      for (const item of bucket) result.push({ type: 'pokemon', key: String(item.num), item });
    }
    return result;
  }, [items]);

  const stickyHeaderIndices = useMemo(
    () => rows.reduce<number[]>((acc, row, i) => { if (row.type === 'header') acc.push(i); return acc; }, []),
    [rows],
  );

  return (
    <FlashList
      data={rows}
      numColumns={cols}
      estimatedItemSize={120}
      keyExtractor={row => row.key}
      getItemType={row => row.type}
      stickyHeaderIndices={stickyHeaderIndices}
      overrideItemLayout={(layout, row, _index, maxColumns) => {
        if (row.type === 'header') layout.span = maxColumns;
      }}
      renderItem={({ item: row }) =>
        row.type === 'header' ? (
          <View style={styles.headerRow}>
            <View style={[
              styles.headerPill,
              { backgroundColor: withAlpha(GEN_COLORS[row.gen] ?? '#888888', 0.16), borderColor: GEN_COLORS[row.gen] ?? '#888888' },
            ]}>
              <Text style={styles.headerEmoji}>{GEN_EMOJI[row.gen] ?? ''}</Text>
              <Text style={styles.headerLabel}>{row.label}</Text>
              <Text style={styles.headerCount}>{row.owned}/{row.total}</Text>
            </View>
          </View>
        ) : (
          <PokemonTile
            pokemon={row.item}
            owned={row.item.owned}
            ownedCardImage={ownedImages?.get(row.item.num)}
            wishedInDex={wishedInDexSet?.has(row.item.num)}
            onPress={() => onSelect(row.item.num)}
            onDoublePress={onDoubleSelect ? () => onDoubleSelect(row.item.num) : undefined}
          />
        )
      }
    />
  );
}
