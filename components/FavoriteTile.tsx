import { View, Text, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useTheme, useThemedStyles, radius, fonts } from '@/lib/theme';

interface Props {
  pokemon: Pokemon;
  cardImage?: string;
  favorited: boolean;
  inShowcase: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onToggleShowcase: () => void;
}

export function FavoriteTile({ pokemon, cardImage, favorited, inShowcase, onPress, onToggleFavorite, onToggleShowcase }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    // Same fix as PokemonTile: 0.85 didn't leave enough room below the image
    // for the number + name lines, which would render past the tile and get
    // covered by the next row.
    tile: { flex: 1, aspectRatio: 0.68, padding: 6, alignItems: 'center' as const, justifyContent: 'flex-start' as const, ...shadow.sm },
    pressed: { transform: [{ scale: 0.95 }] },
    spriteWrap: { width: '100%' as const, aspectRatio: 1, position: 'relative' as const, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
    sprite: { width: '100%' as const, height: '100%' as const },
    starBtn: {
      position: 'absolute' as const, top: 2, right: 2, width: 22, height: 22, borderRadius: radius.pill,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    showcaseBtn: {
      position: 'absolute' as const, top: 2, left: 2, width: 22, height: 22, borderRadius: radius.pill,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    num: { fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted, marginTop: 4 },
    name: { fontSize: 12, fontFamily: fonts.bodyBold, textAlign: 'center' as const, color: colors.text },
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.spriteWrap}>
        <Image source={{ uri: cardImage ?? pokemon.sprite_url }} style={styles.sprite} resizeMode="contain" />
        <Pressable
          hitSlop={8}
          accessibilityLabel={`Vitrine ${getName(pokemon)}`}
          accessibilityRole="button"
          onPress={(e) => { e.stopPropagation(); onToggleShowcase(); }}
          style={styles.showcaseBtn}>
          <Ionicons name={inShowcase ? 'sparkles' : 'sparkles-outline'} size={14} color={inShowcase ? colors.primary : colors.textMuted} />
        </Pressable>
        <Pressable
          hitSlop={8}
          accessibilityLabel={`Favori ${getName(pokemon)}`}
          accessibilityRole="button"
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
