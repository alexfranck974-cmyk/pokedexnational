import { View, Text, Image, Pressable, ScrollView, Linking } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import type { UpcomingSet } from '@/lib/upcoming-sets';

interface Props {
  sets: UpcomingSet[];
}

const CARD_WIDTH = 130;
const CARD_ASPECT = 0.62;

export function UpcomingSetsBanner({ sets }: Props) {
  const t = useT();
  const styles = useThemedStyles((colors, shadow) => ({
    frame: {
      borderRadius: radius.xl, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm,
      ...shadow.md,
    },
    eyebrow: {
      fontSize: 11, fontFamily: fonts.monoBold, letterSpacing: 2, color: colors.textDim,
      textTransform: 'uppercase' as const,
    },
    row: { gap: spacing.sm },
    card: { width: CARD_WIDTH, gap: 4 },
    imgWrap: {
      width: CARD_WIDTH, aspectRatio: CARD_ASPECT, borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt, overflow: 'hidden' as const, ...shadow.sm,
    },
    img: { width: '100%' as const, height: '100%' as const },
    name: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
    date: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted },
  }));

  if (sets.length === 0) return null;

  return (
    <View style={styles.frame}>
      <Text style={styles.eyebrow}>{t('news.upcomingSetsTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {sets.map(s => (
          <Pressable
            key={s.sourceId}
            style={styles.card}
            onPress={() => { if (s.sourceUrl) Linking.openURL(s.sourceUrl); }}>
            <View style={styles.imgWrap}>
              {s.imageUrl && <Image source={{ uri: s.imageUrl }} style={styles.img} resizeMode="cover" />}
            </View>
            <Text style={styles.name} numberOfLines={2}>{s.region === 'jp' ? `🇯🇵 ${s.name}` : s.name}</Text>
            <Text style={styles.date} numberOfLines={1}>{s.releaseDateLabel}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
