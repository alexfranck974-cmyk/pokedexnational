import { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { type TradeOfferItem, useAcceptTrade, useDeclineTrade, useCancelTrade, eurFormatter } from '@/lib/trades';
import { TradeIcon } from './TradeIcon';
import { BubbleSheet } from './BubbleSheet';
import { ConfirmDialog, type ConfirmTarget } from './ConfirmDialog';
import { toast } from '@/lib/toast';
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
  const [confirmingAccept, setConfirmingAccept] = useState(false);

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
    delta: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    deltaPositive: { color: colors.success, fontFamily: fonts.bodyBold },
    deltaNegative: { color: colors.danger, fontFamily: fonts.bodyBold },
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

  const doAccept = () => {
    if (!item || !receive) return;
    setConfirmingAccept(false);
    accept.mutate(item.id, {
      onSuccess: () => { toast('Échange accepté — retrouve-le dans « Échanges en cours » une fois les cartes échangées en vrai.'); onClose(); },
    });
  };
  const doDecline = () => {
    if (!item) return;
    decline.mutate(item.id, { onSuccess: () => { toast('Offre refusée.'); onClose(); } });
  };
  const doCancel = () => {
    if (!item) return;
    cancel.mutate(item.id, { onSuccess: () => { toast('Offre annulée.'); onClose(); } });
  };

  const confirmTarget: ConfirmTarget | null = confirmingAccept && give && receive
    ? {
        title: 'Accepter l’échange',
        message: `Tu donnes ${give.name} et tu reçois ${receive.name}. Une fois les cartes échangées en vrai, vous devrez tous les deux le confirmer pour que ça devienne définitif.`,
      }
    : null;

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
            {give.cardmarketTrendEur != null && <Text style={styles.value}>{eurFormatter().format(give.cardmarketTrendEur)}</Text>}
          </View>
          <TradeIcon size={28} color={TINT} />
          <View style={styles.card}>
            <Text style={styles.label}>Tu reçois</Text>
            <Image source={{ uri: receive.imageSmall }} style={styles.img} resizeMode="contain" />
            <Text style={styles.name} numberOfLines={2}>{receive.name}</Text>
            {receive.cardmarketTrendEur != null && <Text style={styles.value}>{eurFormatter().format(receive.cardmarketTrendEur)}</Text>}
          </View>
        </View>
        {give.cardmarketTrendEur != null && receive.cardmarketTrendEur != null && (
          <Text style={styles.delta}>
            {(() => {
              const delta = receive.cardmarketTrendEur! - give.cardmarketTrendEur!;
              if (Math.abs(delta) < 0.01) return 'Échange équilibré';
              const deltaStyle = delta > 0 ? styles.deltaPositive : styles.deltaNegative;
              return <Text style={deltaStyle}>{delta > 0 ? '+' : ''}{eurFormatter().format(delta)} pour toi</Text>;
            })()}
          </Text>
        )}
        <View style={styles.actions}>
          {incoming ? (
            <>
              <Pressable
                onPress={() => setConfirmingAccept(true)}
                disabled={accept.isPending}
                style={[styles.btn, styles.btnAccept]}>
                <Text style={styles.btnText}>{accept.isPending ? '…' : 'Accepter'}</Text>
              </Pressable>
              <Pressable
                onPress={doDecline}
                disabled={decline.isPending}
                style={[styles.btn, styles.btnDecline]}>
                <Text style={styles.btnTextDecline}>Refuser</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={doCancel}
              disabled={cancel.isPending}
              style={[styles.btn, styles.btnDecline]}>
              <Text style={styles.btnTextDecline}>{cancel.isPending ? '…' : 'Annuler l’offre'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      )}
      <ConfirmDialog
        target={confirmTarget}
        confirmLabel="Accepter"
        tone="primary"
        onConfirm={doAccept}
        onCancel={() => setConfirmingAccept(false)}
      />
    </BubbleSheet>
  );
}
