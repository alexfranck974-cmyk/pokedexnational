import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';
import { colors, radius, spacing, shadow } from '@/lib/theme';

interface Props {
  card: TcgCardRow;
  owned: boolean;
  wished?: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onToggleWish?: () => void;
}

export function CardTile({ card, owned, wished, readOnly, onToggle, onToggleWish }: Props) {
  return (
    <Pressable onPress={readOnly ? undefined : onToggle}
      style={({ pressed }) => [
        styles.tile,
        owned && styles.owned,
        !owned && styles.missing,
        pressed && !readOnly && { transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.imgWrap}>
        <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
        {!readOnly && onToggleWish && (
          <Pressable
            hitSlop={8}
            onPress={(e) => { e.stopPropagation(); onToggleWish(); }}
            style={styles.heartBtn}>
            <Text style={[styles.heart, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.set} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
      {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 2, ...shadow.sm },
  owned:   { borderColor: colors.success, backgroundColor: colors.successBg, borderWidth: 2 },
  missing: { borderColor: 'transparent', opacity: 0.55 },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 0.72 },
  set: { fontSize: 11, fontWeight: '600', marginTop: 4, color: colors.text },
  rarity: { fontSize: 10, color: colors.textMuted },
  heartBtn: {
    position: 'absolute', top: 4, right: 4, width: 28, height: 28,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  heart: { fontSize: 18, color: colors.textDim, lineHeight: 22 },
  heartFilled: { color: colors.danger },
});
