import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';

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
  tile: { flex: 1, padding: 6, borderRadius: 8, borderWidth: 2 },
  owned:   { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  missing: { borderColor: 'transparent', opacity: 0.55 },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 0.72 },
  set: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  rarity: { fontSize: 10, color: '#666' },
  heartBtn: {
    position: 'absolute', top: 4, right: 4, width: 28, height: 28,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  heart: { fontSize: 18, color: '#888', lineHeight: 22 },
  heartFilled: { color: '#ef4444' },
});
