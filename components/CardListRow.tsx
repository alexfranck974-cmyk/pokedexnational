import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { TcgCardRow } from '@/lib/tcg';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';

interface Props {
  card: TcgCardRow;
  owned: boolean;
  wished?: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onToggleWish?: () => void;
  onLongPress?: () => void;
}

export function CardListRow({ card, owned, wished, readOnly, onToggle, onToggleWish, onLongPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.sm, borderRadius: radius.md,
      backgroundColor: colors.surface,
      marginHorizontal: spacing.xs, marginVertical: 3,
    },
    thumbWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.sm, padding: 1.5 },
    holoInner: { borderRadius: radius.sm - 1.5, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.sm, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    thumb: { width: 56, height: 78 },
    thumbMissing: { opacity: 0.4 },
    lockBadge: {
      position: 'absolute' as const, top: '50%' as const, left: '50%' as const, marginLeft: -11, marginTop: -11,
      width: 22, height: 22, borderRadius: 11, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    info: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    nameMissing: { color: colors.textMuted },
    meta: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    rarity: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim },
    actions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heart: { fontSize: 22, color: colors.textDim },
    heartFilled: { color: colors.danger },
  }));

  return (
    <Pressable onPress={readOnly ? undefined : onToggle}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        pressed && !readOnly && { opacity: 0.7 },
      ]}>
      <View style={styles.thumbWrap}>
        {owned ? (
          <LinearGradient
            colors={[colors.primary, colors.warning, colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.holoBorder}>
            <View style={styles.holoInner}>
              <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.plainInner}>
            <Image source={{ uri: card.image_small }} style={[styles.thumb, styles.thumbMissing]} resizeMode="contain" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
            </View>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, !owned && styles.nameMissing]} numberOfLines={1}>{card.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
        {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
      </View>
      <View style={styles.actions}>
        {owned && <Pokeball size={22} />}
        {!readOnly && onToggleWish && (
          <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggleWish(); }}>
            <Text style={[styles.heart, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
