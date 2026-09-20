import { useState } from 'react';
import { View, Text, Image, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { TcgCardRow } from '@/lib/tcg';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { Pokeball } from '@/components/Pokeball';
import { hapticCardAdded } from '@/lib/haptics';
import { useHudDensity } from '@/lib/hud-density';
import { useCardStyle } from '@/lib/card-style';
import { CHASE_GOLD } from '@/lib/rarity-tiers';
import { useT } from '@/lib/locale';
import { FINISH_GRADIENT, pickPrimaryFinish } from '@/lib/finish-visuals';
import { ReverseHoloShimmer } from '@/components/ReverseHoloShimmer';
import type { OwnedCardFinish } from '@/lib/collection';
import { formatCardPriceRange } from '@/lib/trades';
import { useLocale } from '@/lib/locale';

interface Props {
  card: TcgCardRow;
  owned: boolean;
  wished?: boolean;
  readOnly?: boolean;
  /** This printing is the one chosen to represent the Pokémon in the National Dex
   * (vs. other owned printings of the same Pokémon sitting in the ledger) — draws
   * a gold halo + a small star badge instead of the plain holo ring. Keeps its
   * pill-badge look in every card style — a secondary/rare case not worth a
   * bespoke treatment per style. */
  isDexCard?: boolean;
  /** Copies owned — when provided (alongside onIncrement/onDecrement) and the card is owned, shows a +/- stepper. */
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  /** Required unless primaryAction="zoom" (wishlist.tsx doesn't have an "owned"
   * concept to toggle from its grid — see primaryAction below). */
  onToggle?: () => void;
  onToggleWish?: () => void;
  onZoom?: () => void;
  /** Tap behavior: 'toggle' (default) marks owned/unowned, long-press zooms —
   * every existing caller. wishlist.tsx passes 'zoom' instead: it has nothing
   * to toggle from this grid (ownership changes happen from the Pokémon detail
   * page), so tapping a card should just zoom it, not fire the owned-toggle
   * haptic + mutation. */
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
  /** Wishlist-only actions (wishlist.tsx) — omit elsewhere. */
  isPriority?: boolean;
  onTogglePriority?: () => void;
  hasPriceAlert?: boolean;
  alertTriggered?: boolean;
  onSetPriceAlert?: () => void;
}

export function CardTile({ card, owned, wished, readOnly, isDexCard, quantity, onIncrement, onDecrement, onToggle, onToggleWish, onZoom, onOpenDetails, finishes, selectionMode, selected, onToggleSelect, isPriority, onTogglePriority, hasPriceAlert, alertTriggered, onSetPriceAlert, primaryAction = 'toggle' }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const { locale } = useLocale();
  const { density } = useHudDensity();
  const { cardStyle } = useCardStyle();
  const isFlat = cardStyle === 'flat';
  const isReveal = cardStyle === 'reveal';
  // 'reveal' only: hover (web) or press-and-hold (touch) shows the action
  // scrim — at rest there's nothing on the tile but the art and a status dot.
  const [revealed, setRevealed] = useState(false);
  const primaryFinish = pickPrimaryFinish(finishes);
  const priceLabel = formatCardPriceRange(card.cardmarket_low_eur, card.cardmarket_trend_eur, locale);
  const showInfo = density !== 'minimal';

  const styles = useThemedStyles((colors, shadow) => ({
    tile: { flex: 1, padding: spacing.sm, borderRadius: radius.lg, ...shadow.sm },
    tileFlatOwned: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryDark },
    imgWrap: { position: 'relative' as const },
    dexHalo: {
      borderRadius: radius.md,
      shadowColor: CHASE_GOLD, shadowOpacity: 0.9, shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 }, elevation: 10,
    },
    holoBorder: { borderRadius: radius.md, padding: 2 },
    holoInner: { borderRadius: radius.md - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInnerBordered: { borderWidth: 1, borderColor: colors.border },
    img: { width: '100%' as const, aspectRatio: 0.72 },
    imgMissing: { opacity: 0.4 },
    lockBadge: {
      position: 'absolute' as const, top: '50%' as const, left: '50%' as const, marginLeft: -14, marginTop: -14,
      width: 28, height: 28, borderRadius: 14, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    checkboxBadgeChecked: { backgroundColor: colors.primary },
    set: { fontSize: 11, fontFamily: fonts.bodyBold, marginTop: 4, color: colors.text },
    rarity: { fontSize: 10, fontFamily: fonts.body, color: colors.textMuted },
    price: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.success },
    // Flat style: one tidy row (name + price) instead of three stacked lines.
    flatMetaRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'baseline' as const, marginTop: 6, gap: 4 },
    flatName: { flex: 1, fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
    flatSetRow: { fontSize: 9.5, fontFamily: fonts.mono, letterSpacing: 0.4, textTransform: 'uppercase' as const, color: colors.textDim, marginTop: 1 },
    pokeballOverlay: {
      position: 'absolute' as const, top: 4, left: 4,
      backgroundColor: colors.overlay,
      borderRadius: radius.pill, padding: 2,
    },
    // Flat style: bare glyphs directly on the art, no pill behind them —
    // a soft text shadow keeps them legible over varied card art colors.
    flatIcon: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    flatIconTopLeft: { position: 'absolute' as const, top: 4, left: 4 },
    dexBadge: {
      position: 'absolute' as const, bottom: 4, right: 4,
      backgroundColor: CHASE_GOLD, borderRadius: radius.pill, padding: 3,
    },
    detailsBtn: {
      position: 'absolute' as const, bottom: 4, left: 4, width: 24, height: 24,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    priorityBtn: {
      position: 'absolute' as const, bottom: 4, left: 4, width: 24, height: 24,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    alertBtn: {
      position: 'absolute' as const, bottom: 4, right: 4, width: 24, height: 24,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    alertTriggeredBadge: {
      marginTop: 2, alignSelf: 'flex-start' as const, paddingHorizontal: 6, paddingVertical: 2,
      borderRadius: radius.pill, backgroundColor: colors.success,
    },
    alertTriggeredBadgeText: { fontSize: 9, fontFamily: fonts.bodyBold, color: 'white' },
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
    // 'reveal' style only
    revealDot: {
      position: 'absolute' as const, bottom: 5, right: 5, width: 8, height: 8, borderRadius: 4,
      backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surfaceAlt,
    },
    scrim: {
      position: 'absolute' as const, left: 0, right: 0, bottom: 0, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
      paddingHorizontal: 6, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.6)',
    },
    scrimTopRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 6, marginBottom: 4 },
    scrimBottomRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    scrimMeta: { fontSize: 9.5, fontFamily: fonts.mono, color: 'white' },
    scrimPrice: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.success },
  }));

  const hoverProps = isReveal ? {
    onHoverIn: () => setRevealed(true),
    onHoverOut: () => setRevealed(false),
    onPressIn: () => setRevealed(true),
    onPressOut: () => setRevealed(false),
  } as const : {};

  return (
    <Pressable
      {...hoverProps}
      onPress={readOnly ? undefined : () => {
        if (selectionMode) { if (!owned) onToggleSelect?.(); return; }
        if (primaryAction === 'zoom') { onZoom?.(); return; }
        if (!owned) hapticCardAdded();
        onToggle?.();
      }}
      onLongPress={primaryAction === 'zoom' ? undefined : onZoom}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.tile,
        isFlat && owned && styles.tileFlatOwned,
        pressed && !readOnly && { transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.imgWrap}>
        {owned ? (
          isFlat || isReveal ? (
            <View style={[styles.plainInner, isReveal && styles.plainInnerBordered]}>
              <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
              {primaryFinish === 'reverse_holo' && <ReverseHoloShimmer />}
            </View>
          ) : (
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
                  <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
                  {!isDexCard && primaryFinish === 'reverse_holo' && <ReverseHoloShimmer />}
                </View>
              </LinearGradient>
            </View>
          )
        ) : (
          <View style={styles.plainInner}>
            <Image source={{ uri: card.image_small }} style={[styles.img, styles.imgMissing]} resizeMode="contain" />
            {selectionMode ? (
              <View style={[styles.lockBadge, selected && styles.checkboxBadgeChecked]}>
                <Ionicons name={selected ? 'checkmark' : 'square-outline'} size={16} color={selected ? 'white' : colors.textMuted} />
              </View>
            ) : !isReveal && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
              </View>
            )}
          </View>
        )}

        {isDexCard && (
          <View style={styles.dexBadge}>
            <Ionicons name="star" size={12} color="#3b2a06" />
          </View>
        )}

        {isReveal ? (
          <>
            {owned && !revealed && <View style={styles.revealDot} />}
            <Animated.View style={[styles.scrim, { opacity: revealed ? 1 : 0 }]} pointerEvents={revealed ? 'auto' : 'none'}>
              <View style={styles.scrimTopRow}>
                {owned && onOpenDetails && (
                  <Pressable hitSlop={8} accessibilityLabel={t('cardCopy.detailsA11yLabel')} onPress={(e) => { e.stopPropagation(); onOpenDetails(); }}>
                    <Ionicons name="information-circle-outline" size={16} color="white" />
                  </Pressable>
                )}
                {onTogglePriority && (
                  <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yTogglePriority')} onPress={(e) => { e.stopPropagation(); onTogglePriority(); }}>
                    <Ionicons name={isPriority ? 'star' : 'star-outline'} size={15} color={isPriority ? colors.warning : 'white'} />
                  </Pressable>
                )}
                {onSetPriceAlert && (
                  <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yPriceAlert')} onPress={(e) => { e.stopPropagation(); onSetPriceAlert(); }}>
                    <Ionicons name={hasPriceAlert ? 'notifications' : 'notifications-outline'} size={15} color={alertTriggered ? colors.success : 'white'} />
                  </Pressable>
                )}
                {!readOnly && onToggleWish && (
                  <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggleWish(); }}>
                    <Text style={[styles.heart, { fontSize: 16, color: 'white', lineHeight: 18 }, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
                  </Pressable>
                )}
                {owned && onIncrement && onDecrement && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable hitSlop={6} disabled={!quantity} onPress={(e) => { e.stopPropagation(); onDecrement(); }}>
                      <Ionicons name="remove-circle-outline" size={16} color={quantity ? 'white' : 'rgba(255,255,255,0.4)'} />
                    </Pressable>
                    <Text style={[styles.quantityText, { fontSize: 11 }]}>{quantity ?? 1}</Text>
                    <Pressable hitSlop={6} onPress={(e) => { e.stopPropagation(); onIncrement(); }}>
                      <Ionicons name="add-circle-outline" size={16} color="white" />
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={styles.scrimBottomRow}>
                <Text style={styles.scrimMeta} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
                {priceLabel != null && <Text style={styles.scrimPrice}>{priceLabel}</Text>}
              </View>
            </Animated.View>
          </>
        ) : (
          <>
            {owned && (
              isFlat ? (
                <View style={styles.flatIconTopLeft}><Pokeball size={18} /></View>
              ) : (
                <View style={styles.pokeballOverlay}><Pokeball size={22} /></View>
              )
            )}
            {owned && onOpenDetails && (
              <Pressable
                hitSlop={8}
                accessibilityLabel={t('cardCopy.detailsA11yLabel')}
                onPress={(e) => { e.stopPropagation(); onOpenDetails(); }}
                style={styles.detailsBtn}>
                <Ionicons name="information-circle-outline" size={16} color="white" />
              </Pressable>
            )}
            {!readOnly && onToggleWish && (
              isFlat ? (
                <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggleWish(); }} style={{ position: 'absolute', top: 4, right: 4 }}>
                  <Text style={[styles.heart, styles.flatIcon, { fontSize: 20, color: 'white' }, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
                </Pressable>
              ) : (
                <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onToggleWish(); }} style={styles.heartBtn}>
                  <Text style={[styles.heart, wished && styles.heartFilled]}>{wished ? '♥' : '♡'}</Text>
                </Pressable>
              )
            )}
            {onTogglePriority && (
              isFlat ? (
                <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yTogglePriority')} onPress={(e) => { e.stopPropagation(); onTogglePriority(); }} style={{ position: 'absolute', bottom: 4, left: 4 }}>
                  <Ionicons name={isPriority ? 'star' : 'star-outline'} style={styles.flatIcon} size={17} color={isPriority ? colors.warning : 'white'} />
                </Pressable>
              ) : (
                <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yTogglePriority')} onPress={(e) => { e.stopPropagation(); onTogglePriority(); }} style={styles.priorityBtn}>
                  <Ionicons name={isPriority ? 'star' : 'star-outline'} size={15} color={isPriority ? colors.warning : 'white'} />
                </Pressable>
              )
            )}
            {onSetPriceAlert && (
              isFlat ? (
                <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yPriceAlert')} onPress={(e) => { e.stopPropagation(); onSetPriceAlert(); }} style={{ position: 'absolute', bottom: 4, right: 4 }}>
                  <Ionicons name={hasPriceAlert ? 'notifications' : 'notifications-outline'} style={styles.flatIcon} size={17} color={alertTriggered ? colors.success : 'white'} />
                </Pressable>
              ) : (
                <Pressable hitSlop={8} accessibilityLabel={t('wishlist.a11yPriceAlert')} onPress={(e) => { e.stopPropagation(); onSetPriceAlert(); }} style={styles.alertBtn}>
                  <Ionicons name={hasPriceAlert ? 'notifications' : 'notifications-outline'} size={15} color={alertTriggered ? colors.success : 'white'} />
                </Pressable>
              )
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
          </>
        )}
      </View>
      {showInfo && !isReveal && (
        isFlat ? (
          <>
            <View style={styles.flatMetaRow}>
              <Text style={styles.flatName} numberOfLines={1}>{card.name}</Text>
              {priceLabel != null && <Text style={styles.price}>{priceLabel}</Text>}
            </View>
            <Text style={styles.flatSetRow} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
            {alertTriggered && (
              <View style={styles.alertTriggeredBadge}>
                <Text style={styles.alertTriggeredBadgeText}>{t('wishlist.alertTriggeredBadge')}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.set} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
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
        )
      )}
    </Pressable>
  );
}
