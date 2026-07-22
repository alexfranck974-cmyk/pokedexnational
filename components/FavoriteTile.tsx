import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { colors, radius, shadow } from '@/lib/theme';

interface Props {
  pokemon: Pokemon;
  cardImage?: string;
  favorited: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export function FavoriteTile({ pokemon, cardImage, favorited, onPress, onToggleFavorite }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.spriteWrap}>
        <Image source={{ uri: cardImage ?? pokemon.sprite_url }} style={styles.sprite} resizeMode="contain" />
        <Pressable
          hitSlop={8}
          onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          style={styles.starBtn}>
          <Ionicons name={favorited ? 'star' : 'star-outline'} size={16} color={favorited ? colors.warning : colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.num}>#{String(pokemon.num).padStart(4, '0')}</Text>
      <Text style={styles.name} numberOfLines={1}>{getName(pokemon)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, aspectRatio: 0.85, padding: 6, alignItems: 'center', justifyContent: 'flex-start', ...shadow.sm },
  pressed: { transform: [{ scale: 0.95 }] },
  spriteWrap: { width: '100%', aspectRatio: 1, position: 'relative', backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  sprite: { width: '100%', height: '100%' },
  starBtn: {
    position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: radius.pill,
    backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center',
  },
  num: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  name: { fontSize: 12, fontWeight: '700', textAlign: 'center', color: colors.text },
});
