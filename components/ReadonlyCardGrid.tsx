import { FlashList } from '@shopify/flash-list';
import { View, Text, Image, Pressable, useWindowDimensions } from 'react-native';
import { formatCardPriceRange } from '@/lib/trades';
import { useLocale } from '@/lib/locale';
import { useThemedStyles, radius, fonts } from '@/lib/theme';

export interface ReadonlyCardGridItem {
  key: string;
  image: string;
  cardmarketLowEur?: number | null;
  cardmarketTrendEur?: number | null;
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
// lock overlay, no wish heart, just the art, price (when given), and a
// tap-to-zoom.
export function ReadonlyCardGrid({ cards, onZoom }: Props) {
  const { width } = useWindowDimensions();
  const { locale } = useLocale();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, padding: 4 },
    inner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt, ...shadow.sm },
    img: { width: '100%' as const, aspectRatio: 0.72 },
    price: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.success, textAlign: 'center' as const, marginTop: 2 },
  }));

  return (
    <FlashList
      data={cards}
      numColumns={numColsFor(width)}
      maintainVisibleContentPosition={{ disabled: true }}
      keyExtractor={c => c.key}
      renderItem={({ item }) => {
        if (!item) return null;
        const priceLabel = formatCardPriceRange(item.cardmarketLowEur, item.cardmarketTrendEur, locale);
        return (
          <Pressable style={styles.tile} onPress={() => onZoom(item.key)}>
            <View style={styles.inner}>
              <Image source={{ uri: item.image }} style={styles.img} resizeMode="contain" />
            </View>
            {priceLabel != null && <Text style={styles.price} numberOfLines={1}>{priceLabel}</Text>}
          </Pressable>
        );
      }}
    />
  );
}
