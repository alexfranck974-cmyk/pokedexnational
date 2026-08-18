import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { TcgCardRow } from '@/lib/tcg';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';
import { hapticCardAdded } from '@/lib/haptics';
import { CHASE_GOLD } from '@/lib/rarity-tiers';

interface Props {
  card: TcgCardRow;
  owned: boolean;
  wished?: boolean;
  readOnly?: boolean;
  /** This printing is the one chosen to represent the Pokémon in the National Dex
   * (vs. other owned printings of the same Pokémon sitting in the ledger) — draws
   * a gold halo + a small star badge instead of the plain holo ring. */
  isDexCard?: boolean;
  /** Copies owned — when provided (alongside onIncrement/onDecrement) and the card is owned, shows a +/- stepper. */
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onToggle: () => void;
  onToggleWish?: () => void;
  onZoom?: () => void;
  /** Opens the per-finish (normale/holo/reverse) quantity + état editor. */
  onOpenDetails?: () => void;
}

export function CardTile({ card, owned, wished, readOnly, isDexCard, quantity, onIncrement, onDecrement, onToggle, onToggleWish, onZoom, onOpenDetails }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, ...shadow.sm },
    imgWrap: { position: 'relative' as const },
    dexHalo: {
      borderRadius: radius.md,
      shadowColor: CHASE_GOLD, shadowOpacity: 0.9, shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 }, elevation: 10,
    },
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
    dexBadge: {
      position: 'absolute' as const, bottom: 4, right: 4,
      backgroundColor: CHASE_GOLD, borderRadius: radius.pill, padding: 3,
    },
    detailsBtn: {
      position: 'absolute' as const, bottom: 4, left: 4, width: 24, height: 24,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heartBtn: {
      position: 'absolute' as const, top: 4, right: 4, width: 28, height: 28,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heart: { fontSize: 18, color: colors.textDim, lineHeight: 22 },
    heartFilled: { color: colors.danger },
    quantityWrap: { position: 'absolute' as const, bottom: 4, left: 0, right: 0, alignItems: 'center' as const },
    quantityPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
      backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: 4, paddingVertical: 2,
    },
    quantityText: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white', minWidth: 14, textAlign: 'center' as const },
  }));

  return (
    <Pressable onPress={readOnly ? undefined : () => { if (!owned) hapticCardAdded(); onToggle(); }}
      onLongPress={onZoom}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.tile,
        pressed && !readOnly && { transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.imgWrap}>
        {owned ? (
          <View style={isDexCard ? styles.dexHalo : undefined}>
            <LinearGradient
              colors={isDexCard ? [CHASE_GOLD, colors.warning, CHASE_GOLD] : [colors.primary, colors.warning, colors.primary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.holoBorder}>
              <View style={styles.holoInner}>
                <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
              </View>
            </LinearGradient>
          </View>
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
        {isDexCard && (
          <View style={styles.dexBadge}>
            <Ionicons name="star" size={12} color="#3b2a06" />
          </View>
        )}
        {owned && onOpenDetails && (
          <Pressable
            hitSlop={8}
            accessibilityLabel="Voir finition et état"
            onPress={(e) => { e.stopPropagation(); onOpenDetails(); }}
            style={styles.detailsBtn}>
            <Ionicons name="information-circle-outline" size={16} color="white" />
          </Pressable>
        )}
        {!readOnly && onToggleWish && (
          <Pressable
            hitSlop={8}
            onPress={(e) => { e.stopPropagation(); onToggleWish(); }}
            style={styles.heartBtn}>
            <Text style={[styles.heart, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
          </Pressable>
        )}
        {owned && onIncrement && onDecrement && (
          <View style={styles.quantityWrap} pointerEvents="box-none">
            <View style={styles.quantityPill}>
              <Pressable hitSlop={6} disabled={!quantity} onPress={(e) => { e.stopPropagation(); onDecrement(); }}>
                <Ionicons name="remove-circle-outline" size={18} color={quantity ? 'white' : 'rgba(255,255,255,0.4)'} />
              </Pressable>
              <Text style={styles.quantityText}>{quantity ?? 1}</Text>
              <Pressable hitSlop={6} onPress={(e) => { e.stopPropagation(); onIncrement(); }}>
                <Ionicons name="add-circle-outline" size={18} color="white" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.set} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
      {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
    </Pressable>
  );
}
