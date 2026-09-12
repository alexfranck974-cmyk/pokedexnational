import { FlashList } from '@shopify/flash-list';
import { View, Text, Image, Pressable, useWindowDimensions } from 'react-native';
import { formatCardPriceRange } from '@/lib/trades';
import { useLocale, useT } from '@/lib/locale';
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
  /** Shows a small ✕ badge on every thumbnail — the Wishlist's own gallery
   * passes this (same action as the grouped-view thumbnail strip); contexts
   * that are genuinely read-only (a friend's public collection/wishlist)
   * just omit it. */
  onRemove?: (key: string) => void;
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
export function ReadonlyCardGrid({ cards, onZoom, onRemove }: Props) {
  const { width } = useWindowDimensions();
  const { locale } = useLocale();
  const t = useT();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, padding: 4 },
    inner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt, ...shadow.sm, position: 'relative' as const },
    img: { width: '100%' as const, aspectRatio: 0.72 },
    price: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.success, textAlign: 'center' as const, marginTop: 2 },
    removeBadge: {
      position: 'absolute' as const, top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.danger, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    removeBadgeText: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white', lineHeight: 14 },
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
              {onRemove && (
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('wishlist.a11yRemove')}
                  onPress={(e) => { e.stopPropagation(); onRemove(item.key); }}
                  style={styles.removeBadge}>
                  <Text style={styles.removeBadgeText}>✕</Text>
                </Pressable>
              )}
            </View>
            {priceLabel != null && <Text style={styles.price} numberOfLines={1}>{priceLabel}</Text>}
          </Pressable>
        );
      }}
    />
  );
}
