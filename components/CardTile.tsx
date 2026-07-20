import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';
import { colors, radius, spacing, shadow } from '@/lib/theme';
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

export function CardTile({ card, owned, wished, readOnly, onToggle, onToggleWish, onLongPress }: Props) {
  return (
    <Pressable onPress={readOnly ? undefined : onToggle}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        !owned && styles.missing,
        pressed && !readOnly && { transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.imgWrap}>
        <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
        {owned && (
          <View style={styles.pokeballOverlay}>
            <Pokeball size={22} />
          </View>
        )}
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
  tile: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, ...shadow.sm },
  missing: { opacity: 0.55 },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 0.72 },
  set: { fontSize: 11, fontWeight: '600', marginTop: 4, color: colors.text },
  rarity: { fontSize: 10, color: colors.textMuted },
  pokeballOverlay: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill, padding: 2,
  },
  heartBtn: {
    position: 'absolute', top: 4, right: 4, width: 28, height: 28,
    borderRadius: radius.pill, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center',
  },
  heart: { fontSize: 18, color: colors.textDim, lineHeight: 22 },
  heartFilled: { color: colors.danger },
});
