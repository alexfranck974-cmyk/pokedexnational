import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { colors, radius, shadow } from '@/lib/theme';

interface Props {
  pokemon: Pokemon;
  owned: boolean;
  ownedCardImage?: string;
  cardCount?: number;
  wishedInDex?: boolean;
  onPress: () => void;
}

export function PokemonTile({ pokemon, owned, ownedCardImage, cardCount, wishedInDex, onPress }: Props) {
  const useCard = owned && !!ownedCardImage;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, owned && styles.tileOwned, pressed && styles.pressed]}>
      <View style={[styles.spriteWrap, !owned && styles.spriteMissing]}>
        <Image
          source={{ uri: useCard ? ownedCardImage : pokemon.sprite_url }}
          style={styles.sprite}
          resizeMode="contain"
        />
        {owned && <View style={styles.checkBadge}><Text style={styles.checkText}>✓</Text></View>}
        {wishedInDex && (
          <View style={styles.wishBadge}>
            <Text style={styles.wishText}>♥</Text>
          </View>
        )}
      </View>
      <Text style={[styles.num, !owned && styles.textDim]}>
        #{String(pokemon.num).padStart(4, '0')}
      </Text>
      <Text style={[styles.name, !owned && styles.textDim]} numberOfLines={1}>
        {getName(pokemon)}
      </Text>
      {owned && cardCount !== undefined && cardCount > 0 && (
        <Text style={styles.cardCount}>×{cardCount}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, aspectRatio: 0.85, padding: 6, alignItems: 'center', justifyContent: 'flex-start' },
  tileOwned: { ...shadow.sm },
  pressed: { transform: [{ scale: 0.95 }] },
  spriteWrap: { width: '100%', aspectRatio: 1, position: 'relative', backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  spriteMissing: { opacity: 0.35 },
  sprite: { width: '100%', height: '100%' },
  checkBadge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: colors.success,
    borderRadius: radius.pill, width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: 'white', fontSize: 12, fontWeight: '700' },
  wishBadge: {
    position: 'absolute', top: 2, left: 2, backgroundColor: colors.surface,
    borderRadius: radius.pill, width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  wishText: { color: colors.danger, fontSize: 12, fontWeight: '700', lineHeight: 14 },
  num: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  name: { fontSize: 12, fontWeight: '700', textAlign: 'center', color: colors.text },
  textDim: { color: colors.textDim },
  cardCount: { fontSize: 10, color: colors.success, fontWeight: '600' },
});
