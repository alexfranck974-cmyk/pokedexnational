import { FlashList } from '@shopify/flash-list';
import { View, Image, Pressable, useWindowDimensions } from 'react-native';
import { useThemedStyles, radius } from '@/lib/theme';

export interface ReadonlyCardGridItem {
  key: string;
  image: string;
}

interface Props {
  cards: ReadonlyCardGridItem[];
  onZoom: (key: string) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

// A pared-down sibling of CardGallery for contexts where every card shown is
// already known to be owned (a friend's public collection) — no toggle, no
// lock overlay, no wish heart, just the art and a tap-to-zoom.
export function ReadonlyCardGrid({ cards, onZoom }: Props) {
  const { width } = useWindowDimensions();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, padding: 4 },
    inner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt, ...shadow.sm },
    img: { width: '100%' as const, aspectRatio: 0.72 },
  }));

  return (
    <FlashList
      data={cards}
      numColumns={numColsFor(width)}
      estimatedItemSize={140}
      keyExtractor={c => c.key}
      renderItem={({ item }) => (
        <Pressable style={styles.tile} onPress={() => onZoom(item.key)}>
          <View style={styles.inner}>
            <Image source={{ uri: item.image }} style={styles.img} resizeMode="contain" />
          </View>
        </Pressable>
      )}
    />
  );
}
