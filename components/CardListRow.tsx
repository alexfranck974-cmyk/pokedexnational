import { useState } from 'react';
import { View, Text, Image, Pressable, Animated } from 'react-native';
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
import { formatCardPriceRange } from '@/lib/trades';
import { cardDisplayName } from '@/lib/tcg-name';
import { useHudDensity } from '@/lib/hud-density';
import { useCardStyle } from '@/lib/card-style';

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
  /** Required unless primaryAction="zoom" — see CardTile's identical prop. */
  onToggle?: () => void;
  onToggleWish?: () => void;
  onZoom?: () => void;
  primaryAction?: 'toggle' | 'zoom';
  /** Opens the per-finish (normale/holo/reverse) quantity + état editor. */
  onOpenDetails?: () => void;
  /** Finishes owned for this exact card — drives the border shimmer (holo/reverse) when set. */
  finishes?: OwnedCardFinish[];
  /** Bulk-add mode (pinned-set/[setId].tsx): tapping an unowned card toggles `selected`
   * instead of calling onToggle — nothing is written until the caller confirms the batch. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Wishlist-only actions (wishlist.tsx) — see CardTile's identical props for why
   * these are safe to add without colliding with the collection-only ones above. */
  isPriority?: boolean;
  onTogglePriority?: () => void;
  hasPriceAlert?: boolean;
  alertTriggered?: boolean;
  onSetPriceAlert?: () => void;
}

export function CardListRow({ card, owned, wished, readOnly, isDexCard, quantity, onIncrement, onDecrement, onToggle, onToggleWish, onZoom, onOpenDetails, finishes, selectionMode, selected, onToggleSelect, isPriority, onTogglePriority, hasPriceAlert, alertTriggered, onSetPriceAlert, primaryAction = 'toggle' }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const { locale } = useLocale();
  const { density } = useHudDensity();
  const { cardStyle } = useCardStyle();
  const isFlat = cardStyle === 'flat';
  const isReveal = cardStyle === 'reveal';
  const [revealed, setRevealed] = useState(false);
  const primaryFinish = pickPrimaryFinish(finishes);
  const priceLabel = formatCardPriceRange(card.cardmarket_low_eur, card.cardmarket_trend_eur, locale);
  const styles = useThemedStyles((colors) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.sm, borderRadius: radius.md,
      backgroundColor: colors.surface,
      marginHorizontal: spacing.xs, marginVertical: 3,
    },
    rowFlatOwned: { backgroundColor: colors.primarySoft },
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
    checkboxBadgeChecked: { backgroundColor: colors.primary },
    info: { flex: 1, gap: 2 },
    name: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    nameMissing: { color: colors.textMuted },
    meta: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    rarity: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim },
    price: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.success },
    alertTriggeredBadge: {
      alignSelf: 'flex-start' as const, paddingHorizontal: 6, paddingVertical: 1,
      borderRadius: radius.pill, backgroundColor: colors.success, marginTop: 1,
    },
    alertTriggeredBadgeText: { fontSize: 9, fontFamily: fonts.bodyBold, color: 'white' },
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
    <Pressable
      {...(isReveal ? {
        onHoverIn: () => setRevealed(true), onHoverOut: () => setRevealed(false),
        onPressIn: () => setRevealed(true), onPressOut: () => setRevealed(false),
      } : {})}
      onPress={readOnly ? undefined : () => {
        if (selectionMode) { if (!owned) onToggleSelect?.(); return; }
        if (primaryAction === 'zoom') { onZoom?.(); return; }
        if (!owned) hapticCardAdded();
        onToggle?.();
      }}
      onLongPress={primaryAction === 'zoom' ? undefined : onZoom}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        isFlat && owned && styles.rowFlatOwned,
        pressed && !readOnly && { opacity: 0.7 },
      ]}>
      <View style={styles.thumbWrap}>
        {owned && !isFlat && !isReveal ? (
          <View style={isDexCard ? styles.dexHalo : undefined}>
            <LinearGradient
              colors={
                isDexCard ? [CHASE_GOLD, colors.warning, CHASE_GOLD]
                : primaryFinish && FINISH_GRADIENT[primaryFinish] ? FINISH_GRADIENT[primaryFinish]!
                : [colors.primary, colors.primarySoft]
              }
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.holoBorder}>
              <View style={styles.holoInner}>
                <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
                {!isDexCard && primaryFinish === 'reverse_holo' && <ReverseHoloShimmer />}
              </View>
            </LinearGradient>
          </View>
        ) : owned ? (
          <View style={styles.plainInner}>
            <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
            {primaryFinish === 'reverse_holo' && <ReverseHoloShimmer />}
          </View>
        ) : (
          <View style={styles.plainInner}>
            <Image source={{ uri: card.image_small }} style={[styles.thumb, styles.thumbMissing]} resizeMode="contain" />
            <View style={[styles.lockBadge, selectionMode && selected && styles.checkboxBadgeChecked]}>
              {selectionMode ? (
                <Ionicons name={selected ? 'checkmark' : 'square-outline'} size={13} color={selected ? 'white' : colors.textMuted} />
              ) : (
                <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
              )}
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
        <Text style={[styles.name, !owned && styles.nameMissing]} numberOfLines={1}>{cardDisplayName(card, card.dex_num, locale)}</Text>
        {density !== 'minimal' && (
          <>
            <Text style={styles.meta} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
            {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
            {priceLabel != null && (
              <Text style={styles.price} numberOfLines={1}>{priceLabel}</Text>
            )}
            {alertTriggered && (
              <View style={styles.alertTriggeredBadge}>
                <Text style={styles.alertTriggeredBadgeText}>{t('wishlist.alertTriggeredBadge')}</Text>
              </View>
            )}
          </>
        )}
      </View>
      <Animated.View
        style={[styles.actions, isReveal && { opacity: revealed ? 1 : 0 }]}
        pointerEvents={isReveal && !revealed ? 'none' : 'auto'}>
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
        {onTogglePriority && (
          <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yTogglePriority')} onPress={(e) => { e.stopPropagation(); onTogglePriority(); }}>
            <Ionicons name={isPriority ? 'star' : 'star-outline'} size={20} color={isPriority ? colors.warning : colors.textDim} />
          </Pressable>
        )}
        {onSetPriceAlert && (
          <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yPriceAlert')} onPress={(e) => { e.stopPropagation(); onSetPriceAlert(); }}>
            <Ionicons name={hasPriceAlert ? 'notifications' : 'notifications-outline'} size={20} color={alertTriggered ? colors.success : colors.textDim} />
          </Pressable>
        )}
      </Animated.View>
    </Pressable>
  );
}
