import { View, Text, Image } from 'react-native';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useLocale } from '@/lib/locale';
import { useTheme, useThemedStyles, radius, fonts } from '@/lib/theme';

export type CompareBucket = 'both' | 'onlyA' | 'onlyB' | 'neither';

export const COMPARE_BUCKET_COLOR: Record<CompareBucket, string> = {
  both: '#22c55e',
  onlyA: '#60a5fa',
  onlyB: '#c084fc',
  neither: '#9ca3af',
};

interface Props {
  pokemon: Pokemon;
  bucket: CompareBucket;
}

// Deliberately simple/read-only — this is a comparison summary, not a
// collection-management surface (no toggle, no zoom, no owner-specific
// actions), so it doesn't need CardTile/PokemonTile's full interactive prop
// surface. The colored top bar is the whole point: at 1025 tiles, a viewer
// scans for color blocks, not individual sprites.
export function CompareTile({ pokemon, bucket }: Props) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const color = COMPARE_BUCKET_COLOR[bucket];
  const dim = bucket === 'neither';
  const styles = useThemedStyles(() => ({
    tile: { flex: 1, aspectRatio: 0.8, padding: 4, alignItems: 'center' as const },
    bar: { width: '100%' as const, height: 3, borderRadius: 2, marginBottom: 4 },
    spriteWrap: { width: '100%' as const, aspectRatio: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
    sprite: { width: '100%' as const, height: '100%' as const },
    num: { fontSize: 9, fontFamily: fonts.mono, color: colors.textMuted, marginTop: 2 },
    name: { fontSize: 10, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const },
    dimText: { color: colors.textDim },
  }));

  return (
    <View style={styles.tile}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={styles.spriteWrap}>
        <Image
          source={{ uri: pokemon.sprite_url }}
          style={[styles.sprite, dim && { opacity: 0.35 }]}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.num}>#{String(pokemon.num).padStart(4, '0')}</Text>
      <Text style={[styles.name, dim && styles.dimText]} numberOfLines={1}>{getName(pokemon, locale)}</Text>
    </View>
  );
}
