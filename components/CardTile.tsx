import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { TcgCardRow } from '@/lib/tcg';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
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
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, ...shadow.sm },
    imgWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.md, padding: 2 },
    holoInner: { borderRadius: radius.md - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    img: { width: '100%' as const, aspectRatio: 0.72 },
    imgMissing: { opacity: 0.4 },
    lockBadge: {
      position: 'absolute' as const, top: '50%' as const, left: '50%' as const, marginLeft: -14, marginTop: -14,
      width: 28, height: 28, borderRadius: 14, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    set: { fontSize: 11, fontFamily: fonts.bodyBold, marginTop: 4, color: colors.text },
    rarity: { fontSize: 10, fontFamily: fonts.body, color: colors.textMuted },
    pokeballOverlay: {
      position: 'absolute' as const, top: 4, left: 4,
      backgroundColor: colors.overlay,
      borderRadius: radius.pill, padding: 2,
    },
    heartBtn: {
      position: 'absolute' as const, top: 4, right: 4, width: 28, height: 28,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heart: { fontSize: 18, color: colors.textDim, lineHeight: 22 },
    heartFilled: { color: colors.danger },
  }));

  return (
    <Pressable onPress={readOnly ? undefined : onToggle}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && !readOnly && { transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.imgWrap}>
        {owned ? (
          <LinearGradient
            colors={[colors.primary, colors.warning, colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.holoBorder}>
            <View style={styles.holoInner}>
              <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.plainInner}>
            <Image source={{ uri: card.image_small }} style={[styles.img, styles.imgMissing]} resizeMode="contain" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
            </View>
          </View>
        )}
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
