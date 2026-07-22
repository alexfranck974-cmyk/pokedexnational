import { useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export interface ShowcaseItem {
  key: string;
  image: string;
  label: string;
  caption?: string;
  onPress: () => void;
}

interface Props {
  title: string;
  items: ShowcaseItem[];
  emptyHint: string;
}

const TILE_WIDTH = 104;
const TILE_GAP = spacing.sm;
const ITEM_STRIDE = TILE_WIDTH + TILE_GAP;

export function ShowcaseRow({ title, items, emptyHint }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const styles = useThemedStyles((colors, shadow) => ({
    section: { gap: spacing.sm },
    title: { fontSize: 12, fontFamily: fonts.monoBold, letterSpacing: 0.4, color: colors.textMuted, textTransform: 'uppercase' as const },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
    row: { gap: TILE_GAP },
    tile: {
      width: TILE_WIDTH, alignItems: 'center' as const, gap: 4, padding: spacing.xs,
      backgroundColor: colors.surface, borderRadius: radius.md, ...shadow.sm,
    },
    pressed: { backgroundColor: colors.surfaceAlt },
    image: { width: 76, height: 76 },
    label: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const },
    caption: { fontSize: 11, fontFamily: fonts.body, color: colors.success, fontWeight: '600' as const },
    dots: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 4 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.surfaceAlt },
    dotActive: { backgroundColor: colors.primary, width: 14 },
  }));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_STRIDE);
    setActiveIndex(Math.max(0, Math.min(items.length - 1, idx)));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyHint}</Text>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            snapToInterval={ITEM_STRIDE}
            decelerationRate="fast"
            snapToAlignment="start"
            onMomentumScrollEnd={onScrollEnd}
          >
            {items.map(item => (
              <Pressable key={item.key} onPress={item.onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
                <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
                <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
                {item.caption && <Text style={styles.caption} numberOfLines={1}>{item.caption}</Text>}
              </Pressable>
            ))}
          </ScrollView>
          {items.length > 1 && (
            <View style={styles.dots}>
              {items.map((item, i) => (
                <View key={item.key} style={[styles.dot, i === activeIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
