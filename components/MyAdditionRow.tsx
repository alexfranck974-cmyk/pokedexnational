import { View, Text, Image, Pressable } from 'react-native';
import type { MyAdditionItem } from '@/lib/collection';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useLocale } from '@/lib/locale';

interface Props {
  item: MyAdditionItem;
  onPress: () => void;
}

// Deliberately lighter than NewsRow (no reactions/comments — this is a plain
// personal history, not a social feed item) rather than force-fitting the
// FriendNewsItem shape NewsRow is built around.
export function MyAdditionRow({ item, onPress }: Props) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const styles = useThemedStyles((colors, shadow) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.sm,
    },
    thumbWrap: {
      width: 48, height: 66, borderRadius: radius.sm, overflow: 'hidden' as const,
      backgroundColor: colors.surfaceAlt,
    },
    thumb: { width: '100%' as const, height: '100%' as const },
    info: { flex: 1, gap: 2 },
    name: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    meta: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    date: { fontSize: 11, fontFamily: fonts.mono, color: colors.textDim },
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.thumbWrap}>
        <Image source={{ uri: item.imageSmall }} style={styles.thumb} resizeMode="contain" />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{item.setName} · {item.cardNumber}</Text>
      </View>
      <Text style={styles.date}>{new Date(item.acquiredAt).toLocaleDateString(locale)}</Text>
    </Pressable>
  );
}
