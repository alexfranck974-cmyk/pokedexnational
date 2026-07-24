import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useTheme, useThemedStyles, radius, fonts } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';

interface Props {
  pokemon: Pokemon;
  owned: boolean;
  ownedCardImage?: string;
  cardCount?: number;
  wishedInDex?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function PokemonTile({ pokemon, owned, ownedCardImage, cardCount, wishedInDex, onPress, onLongPress }: Props) {
  const useCard = owned && !!ownedCardImage;
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, aspectRatio: 0.85, padding: 6, alignItems: 'center' as const, justifyContent: 'flex-start' as const },
    tileOwned: { ...shadow.sm },
    pressed: { transform: [{ scale: 0.95 }] },
    spriteWrap: { width: '100%' as const, aspectRatio: 1, position: 'relative' as const, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
    spriteMissing: { opacity: 0.55 },
    holoBorder: { width: '100%' as const, aspectRatio: 1, borderRadius: radius.md, padding: 2 },
    holoInner: {
      flex: 1, borderRadius: radius.md - 2, backgroundColor: colors.surfaceAlt,
      overflow: 'hidden' as const, position: 'relative' as const,
    },
    sprite: { width: '100%' as const, height: '100%' as const },
    ownedBadge: { position: 'absolute' as const, top: 2, right: 2 },
    wishBadge: {
      position: 'absolute' as const, top: 2, left: 2, backgroundColor: colors.surface,
      borderRadius: radius.pill, width: 20, height: 20, alignItems: 'center' as const, justifyContent: 'center' as const,
      ...shadow.sm,
    },
    wishText: { color: colors.danger, fontSize: 12, fontWeight: '700' as const, lineHeight: 14 },
    num: { fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted, marginTop: 4 },
    name: { fontSize: 12, fontFamily: fonts.bodyBold, textAlign: 'center' as const, color: colors.text },
    textDim: { color: colors.textDim },
    cardCount: { fontSize: 10, fontFamily: fonts.mono, color: colors.success },
  }));

  const badges = (
    <>
      {owned && <View style={styles.ownedBadge}><Pokeball size={22} /></View>}
      {wishedInDex && (
        <View style={styles.wishBadge}>
          <Text style={styles.wishText}>♥</Text>
        </View>
      )}
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={owned ? onLongPress : undefined}
      delayLongPress={350}
      style={({ pressed }) => [styles.tile, owned && styles.tileOwned, pressed && styles.pressed]}>
      {useCard ? (
        // Real owned card art gets a foil-style gradient edge — a sprite alone doesn't.
        <LinearGradient
          colors={[colors.primary, colors.warning, colors.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.holoBorder}>
          <View style={styles.holoInner}>
            <Image source={{ uri: ownedCardImage }} style={styles.sprite} resizeMode="contain" />
            {badges}
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.spriteWrap, !owned && styles.spriteMissing]}>
          <Image
            source={{ uri: pokemon.sprite_url }}
            style={[styles.sprite, !owned && { tintColor: colors.textDim }]}
            resizeMode="contain"
          />
          {badges}
        </View>
      )}
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
