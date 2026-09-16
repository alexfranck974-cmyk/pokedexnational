import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT, useLocale } from '@/lib/locale';
import type { StringKey } from '@/lib/strings';
import type { RecentAdditionsFilter } from '@/lib/recent-additions-filter';

export interface RecentAdditionItem {
  key: string;
  image: string;
  dexNum: number;
  acquiredAt: string;
  onPress: () => void;
}

interface Props {
  items: RecentAdditionItem[];
  filter: RecentAdditionsFilter;
  onFilterChange: (filter: RecentAdditionsFilter) => void;
}

// Deliberately smaller and quieter than VitrineCarousel — the Vitrine is the
// user's curated "hero" pick, this is just a chronological log. Same
// tap-to-zoom target (CardZoomModal, wired by the caller) as the Vitrine, just
// a plain scroll strip instead of the coverflow treatment.
const THUMB_WIDTH = 48;

const FILTERS: RecentAdditionsFilter[] = ['all', 'chase', 'basic'];
const FILTER_LABEL_KEY: Record<RecentAdditionsFilter, StringKey> = {
  all: 'dashboard.recentFilterAll',
  chase: 'dashboard.recentFilterChase',
  basic: 'dashboard.recentFilterBasic',
};

export function RecentAdditionsStrip({ items, filter, onFilterChange }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const styles = useThemedStyles((colors, shadow) => ({
    wrap: { gap: spacing.xs },
    headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    eyebrow: {
      fontSize: 10, fontFamily: fonts.mono, letterSpacing: 1.5, color: colors.textDim,
      textTransform: 'uppercase' as const,
    },
    filterRow: { flexDirection: 'row' as const, gap: 4 },
    filterChip: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    filterChipActive: { backgroundColor: colors.primary },
    filterChipText: { fontSize: 10, fontFamily: fonts.bodyBold, color: colors.textMuted },
    filterChipTextActive: { color: 'white' },
    row: { gap: spacing.sm },
    item: { width: THUMB_WIDTH, alignItems: 'center' as const, gap: 1 },
    thumbWrap: {
      width: THUMB_WIDTH, aspectRatio: 0.72, borderRadius: radius.sm,
      backgroundColor: colors.surface, overflow: 'hidden' as const, ...shadow.sm,
    },
    thumb: { width: '100%' as const, height: '100%' as const },
    date: { fontSize: 9, fontFamily: fonts.mono, color: colors.textDim },
    empty: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted, paddingVertical: spacing.xs },
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>{t('dashboard.recentAdditionsTitle')}</Text>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <Pressable
              key={f}
              onPress={() => onFilterChange(f)}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {t(FILTER_LABEL_KEY[f])}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>{t('dashboard.recentAdditionsEmpty')}</Text>
      ) : (
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
      )}
    </View>
  );
}
