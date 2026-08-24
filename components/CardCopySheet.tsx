import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BubbleSheet } from './BubbleSheet';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useSession } from '@/lib/auth';
import { useLocale, useT } from '@/lib/locale';
import type { TcgCardRow } from '@/lib/tcg';
import {
  CONDITION_LABELS, getFinishLabel, useOwnedCardFinishRows, useAdjustOwnedCardQuantity, useUpdateFinishCondition,
  type OwnedCardFinish, type OwnedCardCondition,
} from '@/lib/collection';
import { hapticCardAdded } from '@/lib/haptics';

const FINISHES: OwnedCardFinish[] = ['normal', 'holo', 'reverse_holo'];
const CONDITIONS: OwnedCardCondition[] = ['mint', 'near_mint', 'excellent', 'good', 'played', 'poor'];

interface Props {
  /** Card the sheet is open for — sheet is hidden when null. */
  card: TcgCardRow | null;
  onClose: () => void;
}

/** Per-finish (normale/holo/reverse) quantity + état editor for one owned card.
 * The fast tap-to-own gesture elsewhere always manages the 'normal' finish —
 * this sheet is where a second/rarer finish of the same card gets tracked. */
export function CardCopySheet({ card, onClose }: Props) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const t = useT();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: rows = [] } = useOwnedCardFinishRows(userId, card?.id);
  const adjustQuantity = useAdjustOwnedCardQuantity();
  const updateCondition = useUpdateFinishCondition();

  const styles = useThemedStyles((colors) => ({
    body: { padding: spacing.md, gap: spacing.lg },
    header: { flexDirection: 'row' as const, gap: spacing.md, alignItems: 'center' as const },
    thumb: { width: 44, height: 61, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
    headerText: { flex: 1 as const },
    name: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    setLine: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
    finishBlock: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    finishRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    finishLabel: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    qtyText: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text, minWidth: 18, textAlign: 'center' as const },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted },
    chipTextActive: { color: 'white', fontFamily: fonts.bodyBold },
    finishBlockDimmed: { opacity: 0.5 },
    notListedHint: { fontSize: 10, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
  }));

  if (!card) return null;

  const rowFor = (finish: OwnedCardFinish) => rows.find(r => r.finish === finish);
  // TCGplayer-derived — null/empty means "unknown" (not yet synced, or no
  // TCGplayer listing for this print, common for JP/CN cards), never treated
  // as "doesn't exist". Only dims when we positively know the finish isn't listed.
  const knownFinishes = card.available_finishes;
  const isNotListed = (finish: OwnedCardFinish) =>
    !!knownFinishes && knownFinishes.length > 0 && !knownFinishes.includes(finish);

  return (
    <BubbleSheet visible={!!card} onClose={onClose} tint={colors.primary} title={t('cardCopy.title')} sizing="auto">
      <View style={styles.body}>
        <View style={styles.header}>
          <Image source={{ uri: card.image_small }} style={styles.thumb} resizeMode="contain" />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
            <Text style={styles.setLine} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
          </View>
        </View>

        {FINISHES.map(finish => {
          const row = rowFor(finish);
          const quantity = row?.quantity ?? 0;
          const notListed = isNotListed(finish);
          return (
            <View key={finish} style={[styles.finishBlock, notListed && styles.finishBlockDimmed]}>
              <View style={styles.finishRow}>
                <View>
                  <Text style={styles.finishLabel}>{getFinishLabel(finish, locale)}</Text>
                  {notListed && <Text style={styles.notListedHint}>{t('cardCopy.notListedHint')}</Text>}
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    hitSlop={8}
                    disabled={quantity <= 0}
                    accessibilityLabel={t('cardCopy.a11yDecreaseQty', { finish: getFinishLabel(finish, locale) })}
                    onPress={() => adjustQuantity.mutate({ cardId: card.id, finish, delta: -1, currentQuantity: quantity, rarity: card.rarity })}>
                    <Ionicons name="remove-circle-outline" size={22} color={quantity > 0 ? colors.text : colors.textMuted} />
                  </Pressable>
                  <Text style={styles.qtyText}>{quantity}</Text>
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={t('cardCopy.a11yIncreaseQty', { finish: getFinishLabel(finish, locale) })}
                    onPress={() => { hapticCardAdded(); adjustQuantity.mutate({ cardId: card.id, finish, delta: 1, currentQuantity: quantity, rarity: card.rarity }); }}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </View>
              {quantity > 0 && (
                <View style={styles.chipRow}>
                  {CONDITIONS.map(condition => {
                    const active = row?.condition === condition;
                    return (
                      <Pressable
                        key={condition}
                        onPress={() => updateCondition.mutate({ cardId: card.id, finish, condition })}
                        style={[styles.chip, active && styles.chipActive]}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{CONDITION_LABELS[condition]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </BubbleSheet>
  );
}

const footerStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  text: { color: 'white', fontSize: 13, fontFamily: fonts.bodyBold },
});

/** Convenience "modifier finition / état" action for CardZoomModal's footer slot — shown
 * only when the zoomed card is owned (nothing to edit otherwise). */
export function EditCopyFooterButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable style={footerStyles.btn} onPress={onPress}>
      <Ionicons name="information-circle-outline" size={16} color="white" />
      <Text style={footerStyles.text}>{t('cardCopy.editButton')}</Text>
    </Pressable>
  );
}
