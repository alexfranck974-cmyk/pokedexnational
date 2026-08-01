import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/auth';
import {
  useOwnedCardQuantities, useAllOwnedCardsLedgerDetailed, useAllWishedCards, type OwnedCardDetail,
} from '@/lib/collection';
import { useProposeTrade, eurFormatter } from '@/lib/trades';
import { TradeIcon } from './TradeIcon';
import { BubbleSheet } from './BubbleSheet';
import { toast } from '@/lib/toast';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export interface TradeTarget {
  id: string;
  displayName: string;
}

// Minimal shape either an OwnedCardDetail (picked from a list inside this modal)
// or a TradeCard (preset from the marketplace / the instant match popup) both
// already satisfy structurally — decouples this modal's state from where the
// card came from.
export interface PickedCard {
  cardId: string;
  name: string;
  imageSmall: string;
  cardmarketTrendEur?: number | null;
}

interface Props {
  target: TradeTarget | null;
  onClose: () => void;
  /** Pre-selected side, so opening from the marketplace or an instant match
   * popup skips straight to picking the other side instead of starting over. */
  initialOffered?: PickedCard | null;
  initialRequested?: PickedCard | null;
}

const TINT = '#2dd4bf';

export function TradeProposalModal({ target, onClose, initialOffered = null, initialRequested = null }: Props) {
  const { session } = useSession();
  const myId = session?.user.id;
  const friendId = target?.id;

  const { data: myQuantities = new Map<string, number>() } = useOwnedCardQuantities(myId);
  const { data: myLedger = [], isLoading: myLoading } = useAllOwnedCardsLedgerDetailed(myId);
  const { data: friendQuantities = new Map<string, number>() } = useOwnedCardQuantities(friendId);
  const { data: friendLedger = [], isLoading: friendLoading } = useAllOwnedCardsLedgerDetailed(friendId);
  const { data: friendWishlist = [] } = useAllWishedCards(friendId);
  const { data: myWishlist = [] } = useAllWishedCards(myId);

  const [offeredCard, setOfferedCard] = useState<PickedCard | null>(null);
  const [requestedCard, setRequestedCard] = useState<PickedCard | null>(null);
  const proposeTrade = useProposeTrade();

  useEffect(() => {
    if (!target) { setOfferedCard(null); setRequestedCard(null); }
    else { setOfferedCard(initialOffered); setRequestedCard(initialRequested); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const friendWishlistIds = useMemo(() => new Set(friendWishlist.map((c: { id: string }) => c.id)), [friendWishlist]);
  const myWishlistIds = useMemo(() => new Set(myWishlist.map((c: { id: string }) => c.id)), [myWishlist]);

  const myDuplicates = useMemo(
    () => myLedger.filter(c => (myQuantities.get(c.cardId) ?? 0) >= 2),
    [myLedger, myQuantities],
  );
  const offerMatches = useMemo(() => myDuplicates.filter(c => friendWishlistIds.has(c.cardId)), [myDuplicates, friendWishlistIds]);
  const offerCandidates = offerMatches.length > 0 ? offerMatches : myDuplicates;

  const friendDuplicates = useMemo(
    () => friendLedger.filter(c => (friendQuantities.get(c.cardId) ?? 0) >= 2),
    [friendLedger, friendQuantities],
  );
  const requestCandidates = useMemo(
    () => [...friendDuplicates].sort((a, b) => Number(myWishlistIds.has(b.cardId)) - Number(myWishlistIds.has(a.cardId))),
    [friendDuplicates, myWishlistIds],
  );

  const styles = useThemedStyles((colors, shadow) => ({
    hint: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim, padding: spacing.md, paddingBottom: spacing.sm },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, padding: spacing.xl, textAlign: 'center' as const },
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    thumb: { width: 34, height: 34 / 0.72, borderRadius: 3 },
    rowName: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: colors.text },
    matchTag: { fontSize: 11, fontFamily: fonts.bodyBold, color: TINT },
    confirmWrap: { alignItems: 'center' as const, padding: spacing.lg, gap: spacing.md },
    confirmRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    confirmCard: { alignItems: 'center' as const, gap: spacing.xs, width: 110 },
    confirmImg: { width: 100, height: 100 / 0.72, borderRadius: 6 },
    confirmName: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },
    confirmLabel: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.textDim, textTransform: 'uppercase' as const },
    confirmValue: { fontSize: 12, fontFamily: fonts.monoBold, color: colors.success },
    deltaText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    deltaTextPositive: { color: colors.success, fontFamily: fonts.bodyBold },
    deltaTextNegative: { color: colors.danger, fontFamily: fonts.bodyBold },
    btn: {
      flexDirection: 'row' as const, gap: 6, backgroundColor: TINT, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderRadius: radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: spacing.sm,
    },
    btnText: { fontFamily: fonts.bodyBold, color: 'white' },
    backBtn: { padding: 6 },
  }));

  const step: 'offer' | 'request' | 'confirm' = !offeredCard ? 'offer' : !requestedCard ? 'request' : 'confirm';
  const title = step === 'offer' ? `Offrir un doublon à ${target?.displayName ?? ''}`
    : step === 'request' ? 'Demander en retour' : 'Confirmer l’échange';

  const renderList = (data: OwnedCardDetail[], onPick: (c: OwnedCardDetail) => void, matchIds: Set<string>) => (
    <FlatList
      data={data}
      keyExtractor={c => c.cardId}
      renderItem={({ item }) => (
        <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          <Image source={{ uri: item.imageSmall }} style={styles.thumb} resizeMode="contain" />
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          {matchIds.has(item.cardId) && <Text style={styles.matchTag}>★ wishlist</Text>}
        </Pressable>
      )}
    />
  );

  return (
    <BubbleSheet visible={target !== null} onClose={onClose} tint={TINT} title={title}>
      {myLoading || friendLoading ? (
        <ActivityIndicator style={{ margin: spacing.xl }} />
      ) : step === 'offer' ? (
        offerCandidates.length === 0 ? (
          <Text style={styles.empty}>Tu n’as aucun doublon à proposer pour l’instant.</Text>
        ) : (
          <>
            {offerMatches.length > 0 && (
              <Text style={styles.hint}>Ces doublons sont dans la wishlist de {target?.displayName}.</Text>
            )}
            {renderList(offerCandidates, setOfferedCard, friendWishlistIds)}
          </>
        )
      ) : step === 'request' ? (
        requestCandidates.length === 0 ? (
          <Text style={styles.empty}>{target?.displayName} n’a aucun doublon à te proposer en retour pour l’instant.</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
              <Pressable onPress={() => setOfferedCard(null)} hitSlop={8} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={TINT} />
              </Pressable>
              <Text style={styles.hint}>Les cartes marquées ★ sont dans ta wishlist.</Text>
            </View>
            {renderList(requestCandidates, setRequestedCard, myWishlistIds)}
          </>
        )
      ) : (
        <View style={styles.confirmWrap}>
          <View style={styles.confirmRow}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Tu donnes</Text>
              <Image source={{ uri: offeredCard!.imageSmall }} style={styles.confirmImg} resizeMode="contain" />
              <Text style={styles.confirmName} numberOfLines={2}>{offeredCard!.name}</Text>
              {offeredCard!.cardmarketTrendEur != null && (
                <Text style={styles.confirmValue}>{eurFormatter.format(offeredCard!.cardmarketTrendEur)}</Text>
              )}
            </View>
            <TradeIcon size={28} color={TINT} />
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Tu reçois</Text>
              <Image source={{ uri: requestedCard!.imageSmall }} style={styles.confirmImg} resizeMode="contain" />
              <Text style={styles.confirmName} numberOfLines={2}>{requestedCard!.name}</Text>
              {requestedCard!.cardmarketTrendEur != null && (
                <Text style={styles.confirmValue}>{eurFormatter.format(requestedCard!.cardmarketTrendEur)}</Text>
              )}
            </View>
          </View>
          {offeredCard!.cardmarketTrendEur != null && requestedCard!.cardmarketTrendEur != null && (
            <Text style={styles.deltaText}>
              {(() => {
                const delta = requestedCard!.cardmarketTrendEur! - offeredCard!.cardmarketTrendEur!;
                if (Math.abs(delta) < 0.01) return 'Échange équilibré';
                const style = delta > 0 ? styles.deltaTextPositive : styles.deltaTextNegative;
                return <Text style={style}>{delta > 0 ? '+' : ''}{eurFormatter.format(delta)} pour toi</Text>;
              })()}
            </Text>
          )}
          <Pressable
            onPress={() => {
              if (!target || !offeredCard || !requestedCard) return;
              proposeTrade.mutate(
                { receiverId: target.id, offeredCardId: offeredCard.cardId, requestedCardId: requestedCard.cardId },
                { onSuccess: () => { toast(`Proposition envoyée à ${target.displayName} !`); onClose(); } },
              );
            }}
            disabled={proposeTrade.isPending}
            style={styles.btn}>
            <TradeIcon size={16} color="white" />
            <Text style={styles.btnText}>{proposeTrade.isPending ? '…' : 'Proposer l’échange'}</Text>
          </Pressable>
          <Pressable onPress={() => setRequestedCard(null)}>
            <Text style={styles.hint}>Changer la carte demandée</Text>
          </Pressable>
        </View>
      )}
    </BubbleSheet>
  );
}
