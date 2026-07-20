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

export function CardListRow({ card, owned, wished, readOnly, onToggle, onToggleWish }: Props) {
  return (
    <Pressable onPress={readOnly ? undefined : onToggle}
      style={({ pressed }) => [styles.row, owned && styles.rowOwned, pressed && !readOnly && { opacity: 0.7 }]}>
      <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
        {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
      </View>
      <View style={styles.actions}>
        {owned && <Text style={styles.ownedTag}>✓</Text>}
        {!readOnly && onToggleWish && (
          <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggleWish(); }}>
            <Text style={[styles.heart, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee', backgroundColor: 'white' },
  rowOwned: { backgroundColor: '#f0fdf4' },
  thumb: { width: 56, height: 78 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, color: '#555' },
  rarity: { fontSize: 11, color: '#888' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownedTag: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
  heart: { fontSize: 22, color: '#888' },
  heartFilled: { color: '#ef4444' },
});
