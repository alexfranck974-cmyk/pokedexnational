import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT, useLocale } from '@/lib/locale';

export interface RecentAdditionItem {
  key: string;
  image: string;
  dexNum: number;
  acquiredAt: string;
  onPress: () => void;
}

interface Props {
  items: RecentAdditionItem[];
}

// Deliberately smaller and quieter than VitrineCarousel — the Vitrine is the
// user's curated "hero" pick, this is just a chronological log. Same
// tap-to-zoom target (CardZoomModal, wired by the caller) as the Vitrine, just
// a plain scroll strip instead of the coverflow treatment.
const THUMB_WIDTH = 48;

export function RecentAdditionsStrip({ items }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const styles = useThemedStyles((colors, shadow) => ({
    wrap: { gap: spacing.xs },
    eyebrow: {
      fontSize: 10, fontFamily: fonts.mono, letterSpacing: 1.5, color: colors.textDim,
      textTransform: 'uppercase' as const,
    },
    row: { gap: spacing.sm },
    item: { width: THUMB_WIDTH, alignItems: 'center' as const, gap: 1 },
    thumbWrap: {
      width: THUMB_WIDTH, aspectRatio: 0.72, borderRadius: radius.sm,
      backgroundColor: colors.surface, overflow: 'hidden' as const, ...shadow.sm,
    },
    thumb: { width: '100%' as const, height: '100%' as const },
    date: { fontSize: 9, fontFamily: fonts.mono, color: colors.textDim },
  }));

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{t('dashboard.recentAdditionsTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map(item => (
          <Pressable key={item.key} onPress={item.onPress} style={styles.item}>
            <View style={styles.thumbWrap}>
              <Image source={{ uri: item.image }} style={styles.thumb} resizeMode="contain" />
            </View>
            <Text style={styles.date}>{new Date(item.acquiredAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
