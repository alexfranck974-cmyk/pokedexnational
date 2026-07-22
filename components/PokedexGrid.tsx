import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PokemonTile } from './PokemonTile';
import type { PokemonWithState } from '@/lib/pokedex-list';
import { GENERATIONS } from '@/lib/generations';
import { colors, radius, spacing } from '@/lib/theme';

interface Props {
  items: PokemonWithState[];
  ownedImages?: Map<number, string>;
  wishedInDexSet?: Set<number>;
  columnsOverride?: 2 | 3 | 4 | null;
  onSelect: (num: number) => void;
}

type GridRow =
  | { type: 'header'; key: string; label: string; owned: number; total: number }
  | { type: 'pokemon'; key: string; item: PokemonWithState };

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

export function PokedexGrid({ items, ownedImages, wishedInDexSet, columnsOverride, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const cols = columnsOverride ?? numColsFor(width);

  const rows = useMemo(() => {
    const result: GridRow[] = [];
    for (const gen of GENERATIONS) {
      const bucket = items.filter(p => p.num >= gen.min && p.num <= gen.max);
      if (bucket.length === 0) continue;
      const owned = bucket.filter(p => p.owned).length;
      result.push({ type: 'header', key: `header-${gen.gen}`, label: gen.label, owned, total: bucket.length });
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
          <View style={styles.header}>
            <Text style={styles.headerLabel}>{row.label}</Text>
            <Text style={styles.headerCount}>{row.owned}/{row.total}</Text>
          </View>
        ) : (
          <PokemonTile
            pokemon={row.item}
            owned={row.item.owned}
            ownedCardImage={ownedImages?.get(row.item.num)}
            wishedInDex={wishedInDexSet?.has(row.item.num)}
            onPress={() => onSelect(row.item.num)}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.sm,
  },
  headerLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
