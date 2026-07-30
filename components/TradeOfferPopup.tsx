import { View, Text, Image, Pressable } from 'react-native';
import { type TradeOfferItem, useAcceptTrade, useDeclineTrade, useCancelTrade } from '@/lib/trades';
import { TradeIcon } from './TradeIcon';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  item: TradeOfferItem | null;
  onClose: () => void;
}

const TINT = '#2dd4bf';

export function TradeOfferPopup({ item, onClose }: Props) {
  const accept = useAcceptTrade();
  const decline = useDeclineTrade();
  const cancel = useCancelTrade();

  const styles = useThemedStyles((colors, shadow) => ({
    body: { alignItems: 'center' as const, padding: spacing.lg, gap: spacing.md },
    subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    subtitleBold: { fontFamily: fonts.bodyBold, color: colors.text },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    card: { alignItems: 'center' as const, gap: spacing.xs, width: 110 },
    img: { width: 100, height: 100 / 0.72, borderRadius: 6 },
    label: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.textDim, textTransform: 'uppercase' as const },
    name: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    actions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.xs },
    btn: {
      flexDirection: 'row' as const, gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderRadius: radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    btnAccept: { backgroundColor: TINT },
    btnDecline: { backgroundColor: colors.surfaceAlt },
    btnText: { fontFamily: fonts.bodyBold, color: 'white' },
    btnTextDecline: { fontFamily: fonts.bodyBold, color: colors.textMuted },
  }));

  const incoming = item?.direction === 'incoming';
  // From the viewer's perspective: what they'd give / receive, regardless of
  // who proposed — offeredCard/requestedCard are always framed from the
  // proposer's side in storage, so flip the labels when viewing an incoming offer.
  const give = item ? (incoming ? item.requestedCard : item.offeredCard) : null;
  const receive = item ? (incoming ? item.offeredCard : item.requestedCard) : null;

  return (
    <BubbleSheet
      visible={item !== null}
      onClose={onClose}
      tint={TINT}
      title={item ? (incoming ? `Proposition de ${item.counterpartyName}` : `En attente de ${item.counterpartyName}`) : undefined}>
      {item && give && receive && (
      <View style={styles.body}>
        <Text style={styles.subtitle}>
          {incoming
            ? <><Text style={styles.subtitleBold}>{item.counterpartyName}</Text> te propose un échange</>
            : <>Tu attends la réponse de <Text style={styles.subtitleBold}>{item.counterpartyName}</Text></>}
        </Text>
        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.label}>Tu donnes</Text>
            <Image source={{ uri: give.imageSmall }} style={styles.img} resizeMode="contain" />
            <Text style={styles.name} numberOfLines={2}>{give.name}</Text>
          </View>
          <TradeIcon size={28} color={TINT} />
          <View style={styles.card}>
            <Text style={styles.label}>Tu reçois</Text>
            <Image source={{ uri: receive.imageSmall }} style={styles.img} resizeMode="contain" />
            <Text style={styles.name} numberOfLines={2}>{receive.name}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {incoming ? (
            <>
              <Pressable
                onPress={() => accept.mutate(item.id, { onSuccess: onClose })}
                disabled={accept.isPending}
                style={[styles.btn, styles.btnAccept]}>
                <Text style={styles.btnText}>{accept.isPending ? '…' : 'Accepter'}</Text>
              </Pressable>
              <Pressable
                onPress={() => decline.mutate(item.id, { onSuccess: onClose })}
                disabled={decline.isPending}
                style={[styles.btn, styles.btnDecline]}>
                <Text style={styles.btnTextDecline}>Refuser</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => cancel.mutate(item.id, { onSuccess: onClose })}
              disabled={cancel.isPending}
              style={[styles.btn, styles.btnDecline]}>
              <Text style={styles.btnTextDecline}>{cancel.isPending ? '…' : 'Annuler l’offre'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      )}
    </BubbleSheet>
  );
}
