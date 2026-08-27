import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { TcgCardRow } from '@/lib/tcg';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';
import { hapticCardAdded } from '@/lib/haptics';
import { CHASE_GOLD } from '@/lib/rarity-tiers';
import { useLocale, useT } from '@/lib/locale';
import { FINISH_GRADIENT, pickPrimaryFinish } from '@/lib/finish-visuals';
import { ReverseHoloShimmer } from '@/components/ReverseHoloShimmer';
import type { OwnedCardFinish } from '@/lib/collection';
import { eurFormatter } from '@/lib/trades';

interface Props {
  card: TcgCardRow;
  owned: boolean;
  wished?: boolean;
  readOnly?: boolean;
  /** This printing is the one chosen to represent the Pokémon in the National Dex — see CardTile. */
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
  /** Finishes owned for this exact card — drives the border shimmer (holo/reverse) when set. */
  finishes?: OwnedCardFinish[];
}

export function CardListRow({ card, owned, wished, readOnly, isDexCard, quantity, onIncrement, onDecrement, onToggle, onToggleWish, onZoom, onOpenDetails, finishes }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const { locale } = useLocale();
  const primaryFinish = pickPrimaryFinish(finishes);
  const styles = useThemedStyles((colors) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.sm, borderRadius: radius.md,
      backgroundColor: colors.surface,
      marginHorizontal: spacing.xs, marginVertical: 3,
    },
    thumbWrap: { position: 'relative' as const },
    dexHalo: {
      borderRadius: radius.sm,
      shadowColor: CHASE_GOLD, shadowOpacity: 0.9, shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 }, elevation: 6,
    },
    dexBadge: {
      position: 'absolute' as const, bottom: -2, right: -2,
      backgroundColor: CHASE_GOLD, borderRadius: radius.pill, padding: 2,
    },
    holoBorder: { borderRadius: radius.sm, padding: 1.5 },
    holoInner: { borderRadius: radius.sm - 1.5, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.sm, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    thumb: { width: 56, height: 78 },
    thumbMissing: { opacity: 0.4 },
    lockBadge: {
      position: 'absolute' as const, top: '50%' as const, left: '50%' as const, marginLeft: -11, marginTop: -11,
      width: 22, height: 22, borderRadius: 11, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    info: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    nameMissing: { color: colors.textMuted },
    meta: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    rarity: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim },
    price: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.success },
    actions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heart: { fontSize: 22, color: colors.textDim },
    heartFilled: { color: colors.danger },
    quantityPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
      backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 4, paddingVertical: 2,
    },
    quantityText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.text, minWidth: 14, textAlign: 'center' as const },
  }));

  return (
    <Pressable onPress={readOnly ? undefined : () => { if (!owned) hapticCardAdded(); onToggle(); }}
      onLongPress={onZoom}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        pressed && !readOnly && { opacity: 0.7 },
      ]}>
      <View style={styles.thumbWrap}>
        {owned ? (
          <View style={isDexCard ? styles.dexHalo : undefined}>
            <LinearGradient
              colors={
                isDexCard ? [CHASE_GOLD, colors.warning, CHASE_GOLD]
                : primaryFinish && FINISH_GRADIENT[primaryFinish] ? FINISH_GRADIENT[primaryFinish]!
                : [colors.primary, colors.warning, colors.primary]
              }
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.holoBorder}>
              <View style={styles.holoInner}>
                <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
                {!isDexCard && primaryFinish === 'reverse_holo' && <ReverseHoloShimmer />}
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.plainInner}>
            <Image source={{ uri: card.image_small }} style={[styles.thumb, styles.thumbMissing]} resizeMode="contain" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
            </View>
          </View>
        )}
        {isDexCard && (
          <View style={styles.dexBadge}>
            <Ionicons name="star" size={10} color="#3b2a06" />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, !owned && styles.nameMissing]} numberOfLines={1}>{card.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
        {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
        {card.cardmarket_trend_eur != null && (
          <Text style={styles.price} numberOfLines={1}>{eurFormatter(locale).format(card.cardmarket_trend_eur)}</Text>
        )}
      </View>
      <View style={styles.actions}>
        {owned && onIncrement && onDecrement ? (
          <View style={styles.quantityPill}>
            <Pressable hitSlop={6} disabled={!quantity} onPress={(e) => { e.stopPropagation(); onDecrement(); }}>
              <Ionicons name="remove-circle-outline" size={18} color={quantity ? colors.textMuted : colors.border} />
            </Pressable>
            <Text style={styles.quantityText}>{quantity ?? 1}</Text>
            <Pressable hitSlop={6} onPress={(e) => { e.stopPropagation(); onIncrement(); }}>
              <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          owned && <Pokeball size={22} />
        )}
        {owned && onOpenDetails && (
          <Pressable hitSlop={8} accessibilityLabel={t('cardCopy.detailsA11yLabel')} onPress={(e) => { e.stopPropagation(); onOpenDetails(); }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {!readOnly && onToggleWish && (
          <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggleWish(); }}>
            <Text style={[styles.heart, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
