import { View, Text, Image, Pressable } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
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
  const styles = useThemedStyles((colors) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.sm, borderRadius: radius.md,
      backgroundColor: colors.surface,
      marginHorizontal: spacing.xs, marginVertical: 3,
    },
    thumb: { width: 56, height: 78 },
    info: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
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
      <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
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
