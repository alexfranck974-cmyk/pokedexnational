import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { BubbleSheet } from './BubbleSheet';
import { useSetWishPriceAlert } from '@/lib/collection';
import type { WishlistCard } from '@/lib/wishlist-list';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useLocale, useT } from '@/lib/locale';
import { eurFormatter } from '@/lib/trades';

interface Props {
  card: WishlistCard | null;
  onClose: () => void;
}

// Target price for a wishlist card — tcg_cards.cardmarket_trend_eur is
// already synced weekly (see sync:tcg:prices / sync:tcgdex:prices), so
// there's no separate check to run: the wishlist screen just compares the
// two live on every render (see isPriceAlertTriggered in lib/wishlist-list.ts).
export function PriceAlertSheet({ card, onClose }: Props) {
  const { locale } = useLocale();
  const t = useT();
  const { colors } = useTheme();
  const setPriceAlert = useSetWishPriceAlert();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (card) setValue(card.price_alert_eur != null ? String(card.price_alert_eur).replace('.', ',') : '');
  }, [card]);

  const styles = useThemedStyles((colors) => ({
    body: { padding: spacing.md, gap: spacing.md },
    hint: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    currentPrice: { fontSize: 13, fontFamily: fonts.monoBold, color: colors.text },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12,
      fontSize: 17, fontFamily: fonts.monoBold, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    row: { flexDirection: 'row' as const, gap: spacing.sm },
    saveBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' as const },
    saveBtnText: { color: 'white', fontFamily: fonts.bodyBold, fontSize: 15 },
    clearBtn: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    clearBtnText: { color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 15 },
  }));

  if (!card) return null;

  const save = () => {
    const parsed = Number(value.replace(',', '.').trim());
    if (!value.trim() || Number.isNaN(parsed) || parsed <= 0) return;
    setPriceAlert.mutate({ cardId: card.id, priceAlertEur: parsed });
    onClose();
  };

  const clear = () => {
    setPriceAlert.mutate({ cardId: card.id, priceAlertEur: null });
    onClose();
  };

  return (
    <BubbleSheet visible={!!card} onClose={onClose} tint={colors.primary} title={t('wishlist.priceAlertSheetTitle')} sizing="auto">
      <View style={styles.body}>
        <Text style={styles.hint}>{t('wishlist.priceAlertHint')}</Text>
        {card.cardmarket_trend_eur != null && (
          <Text style={styles.currentPrice}>
            {t('wishlist.priceAlertCurrentPrice', { price: eurFormatter(locale).format(card.cardmarket_trend_eur) })}
          </Text>
        )}
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={t('wishlist.priceAlertPlaceholder')}
          keyboardType="decimal-pad"
          autoFocus
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{t('wishlist.priceAlertSave')}</Text>
          </Pressable>
        </View>
        {card.price_alert_eur != null && (
          <Pressable onPress={clear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>{t('wishlist.priceAlertClear')}</Text>
          </Pressable>
        )}
      </View>
    </BubbleSheet>
  );
}
