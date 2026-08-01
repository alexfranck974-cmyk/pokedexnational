import { View, Text, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type TradeInProgressItem, useConfirmTradeExchange, eurFormatter } from '@/lib/trades';
import { TradeIcon } from './TradeIcon';
import { BubbleSheet } from './BubbleSheet';
import { toast } from '@/lib/toast';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  item: TradeInProgressItem | null;
  onClose: () => void;
}

const TINT = '#2dd4bf';

// The other half of TradeOfferPopup's flow: once an offer is accepted it
// stops being a proposal and becomes a real-world exchange to carry out —
// this is where both sides confirm it actually happened, which is what
// finally moves the cards (see confirm_trade_exchange in migration 035).
export function TradeInProgressPopup({ item, onClose }: Props) {
  const confirm = useConfirmTradeExchange();
  const { colors } = useTheme();

  const styles = useThemedStyles((colors, shadow) => ({
    body: { alignItems: 'center' as const, padding: spacing.lg, gap: spacing.md },
    subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    subtitleBold: { fontFamily: fonts.bodyBold, color: colors.text },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    card: { alignItems: 'center' as const, gap: spacing.xs, width: 110 },
    img: { width: 100, height: 100 / 0.72, borderRadius: 6 },
    label: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.textDim, textTransform: 'uppercase' as const },
    name: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    value: { fontSize: 12, fontFamily: fonts.monoBold, color: colors.success },
    statusRow: { flexDirection: 'row' as const, gap: spacing.lg, marginTop: spacing.xs },
    statusItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
    statusText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    statusTextDone: { color: colors.success, fontFamily: fonts.bodyBold },
    hint: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim, textAlign: 'center' as const, fontStyle: 'italic' as const },
    actions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.xs },
    btn: {
      flexDirection: 'row' as const, gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderRadius: radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    btnConfirm: { backgroundColor: TINT },
    btnText: { fontFamily: fonts.bodyBold, color: 'white' },
  }));

  const incoming = item?.direction === 'incoming';
  const give = item ? (incoming ? item.requestedCard : item.offeredCard) : null;
  const receive = item ? (incoming ? item.offeredCard : item.requestedCard) : null;

  const doConfirm = () => {
    if (!item || !receive) return;
    const completesIt = item.counterpartyConfirmed;
    confirm.mutate(item.id, {
      onSuccess: () => {
        toast(completesIt
          ? `Échange finalisé — tu as maintenant ${receive.name} !`
          : `Confirmation enregistrée — en attente de ${item.counterpartyName}.`);
        onClose();
      },
    });
  };

  return (
    <BubbleSheet
      visible={item !== null}
      onClose={onClose}
      tint={TINT}
      title={item ? `Échange en cours avec ${item.counterpartyName}` : undefined}>
      {item && give && receive && (
        <View style={styles.body}>
          <Text style={styles.subtitle}>
            Une fois les cartes échangées en vrai, confirmez tous les deux ici pour finaliser.
          </Text>
          <View style={styles.row}>
            <View style={styles.card}>
              <Text style={styles.label}>Tu donnes</Text>
              <Image source={{ uri: give.imageSmall }} style={styles.img} resizeMode="contain" />
              <Text style={styles.name} numberOfLines={2}>{give.name}</Text>
              {give.cardmarketTrendEur != null && <Text style={styles.value}>{eurFormatter.format(give.cardmarketTrendEur)}</Text>}
            </View>
            <TradeIcon size={28} color={TINT} />
            <View style={styles.card}>
              <Text style={styles.label}>Tu reçois</Text>
              <Image source={{ uri: receive.imageSmall }} style={styles.img} resizeMode="contain" />
              <Text style={styles.name} numberOfLines={2}>{receive.name}</Text>
              {receive.cardmarketTrendEur != null && <Text style={styles.value}>{eurFormatter.format(receive.cardmarketTrendEur)}</Text>}
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name={item.myConfirmed ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={item.myConfirmed ? '#22c55e' : colors.textMuted} />
              <Text style={[styles.statusText, item.myConfirmed && styles.statusTextDone]}>Toi</Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons name={item.counterpartyConfirmed ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={item.counterpartyConfirmed ? '#22c55e' : colors.textMuted} />
              <Text style={[styles.statusText, item.counterpartyConfirmed && styles.statusTextDone]}>{item.counterpartyName}</Text>
            </View>
          </View>
          {item.myConfirmed ? (
            <Text style={styles.hint}>En attente de la confirmation de {item.counterpartyName}.</Text>
          ) : (
            <View style={styles.actions}>
              <Pressable onPress={doConfirm} disabled={confirm.isPending} style={[styles.btn, styles.btnConfirm]}>
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={styles.btnText}>{confirm.isPending ? '…' : 'J’ai échangé la carte'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </BubbleSheet>
  );
}
