import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, FlatList, ActivityIndicator, TextInput, ScrollView } from 'react-native';
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

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface SetOption { id: string; name: string; }

function collectSetOptions(cards: { setId?: string; setName?: string }[]): SetOption[] {
  const seen = new Map<string, string>();
  for (const c of cards) if (c.setId && c.setName && !seen.has(c.setId)) seen.set(c.setId, c.setName);
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

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
  const [search, setSearch] = useState('');
  const [setFilter, setSetFilter] = useState<string | null>(null);
  const proposeTrade = useProposeTrade();

  useEffect(() => {
    if (!target) { setOfferedCard(null); setRequestedCard(null); }
    else { setOfferedCard(initialOffered); setRequestedCard(initialRequested); }
    setSearch('');
    setSetFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // A different collection (mine vs the friend's) applies at each step, so a
  // search/filter left over from the previous step wouldn't make sense —
  // clear it whenever the picked card (and therefore the step) changes.
  const pickOffered = (c: OwnedCardDetail) => { setOfferedCard(c); setSearch(''); setSetFilter(null); };
  const pickRequested = (c: OwnedCardDetail) => { setRequestedCard(c); setSearch(''); setSetFilter(null); };

  const friendWishlistIds = useMemo(() => new Set(friendWishlist.map((c: { id: string }) => c.id)), [friendWishlist]);
  const myWishlistIds = useMemo(() => new Set(myWishlist.map((c: { id: string }) => c.id)), [myWishlist]);

  // Anything you own can be offered — not just duplicates. Wishlist matches
  // (what the friend is actually looking for) surface first regardless of
  // duplicate status, then the rest of your collection so a trade is never a
  // dead end just because you happen to have no spare copies right now.
  const offerMatches = useMemo(() => myLedger.filter(c => friendWishlistIds.has(c.cardId)), [myLedger, friendWishlistIds]);
  const offerCandidates = useMemo(() => {
    const matchIds = new Set(offerMatches.map(c => c.cardId));
    return [...offerMatches, ...myLedger.filter(c => !matchIds.has(c.cardId))];
  }, [myLedger, offerMatches]);

  const friendDuplicates = useMemo(
    () => friendLedger.filter(c => (friendQuantities.get(c.cardId) ?? 0) >= 2),
    [friendLedger, friendQuantities],
  );
  const requestCandidates = useMemo(
    () => [...friendDuplicates].sort((a, b) => Number(myWishlistIds.has(b.cardId)) - Number(myWishlistIds.has(a.cardId))),
    [friendDuplicates, myWishlistIds],
  );

  // Search + set filter — collections can run into the hundreds of cards, so
  // scrolling a flat list to find one specific card doesn't scale.
  const offerSetOptions = useMemo(() => collectSetOptions(offerCandidates), [offerCandidates]);
  const requestSetOptions = useMemo(() => collectSetOptions(requestCandidates), [requestCandidates]);
  const searchN = normalize(search.trim());
  const filteredOfferCandidates = useMemo(
    () => offerCandidates.filter(c =>
      (!searchN || normalize(c.name).includes(searchN)) && (!setFilter || c.setId === setFilter)),
    [offerCandidates, searchN, setFilter],
  );
  const filteredRequestCandidates = useMemo(
    () => requestCandidates.filter(c =>
      (!searchN || normalize(c.name).includes(searchN)) && (!setFilter || c.setId === setFilter)),
    [requestCandidates, searchN, setFilter],
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
    dupTag: { fontSize: 12, fontFamily: fonts.monoBold, color: colors.textMuted },
    uniqueTag: { fontSize: 10, fontFamily: fonts.bodyBold, color: colors.danger, textTransform: 'uppercase' as const },
    uniqueWarning: { fontSize: 12, fontFamily: fonts.body, color: colors.danger, textAlign: 'center' as const },
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
    searchInput: {
      marginHorizontal: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 8,
      fontSize: 14, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    setChips: { flexDirection: 'row' as const, gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
    setChip: {
      paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    setChipActive: { backgroundColor: TINT, borderColor: TINT },
    setChipText: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.textMuted },
    setChipTextActive: { color: 'white' },
  }));

  const step: 'offer' | 'request' | 'confirm' = !offeredCard ? 'offer' : !requestedCard ? 'request' : 'confirm';
  const title = step === 'offer' ? `Offrir une carte à ${target?.displayName ?? ''}`
    : step === 'request' ? 'Demander en retour' : 'Confirmer l’échange';

  const renderList = (data: OwnedCardDetail[], onPick: (c: OwnedCardDetail) => void, matchIds: Set<string>, quantities?: Map<string, number>) => (
    <FlatList
      data={data}
      keyExtractor={c => c.cardId}
      renderItem={({ item }) => {
        const qty = quantities?.get(item.cardId) ?? 0;
        return (
          <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Image source={{ uri: item.imageSmall }} style={styles.thumb} resizeMode="contain" />
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            {matchIds.has(item.cardId) && <Text style={styles.matchTag}>★ wishlist</Text>}
            {quantities && (qty >= 2
              ? <Text style={styles.dupTag}>×{qty}</Text>
              : <Text style={styles.uniqueTag}>unique</Text>)}
          </Pressable>
        );
      }}
    />
  );

  const renderSearchAndFilters = (setOptions: SetOption[]) => (
    <>
      <TextInput
        placeholder="Chercher une carte…"
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      {setOptions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.setChips}>
          <Pressable onPress={() => setSetFilter(null)} style={[styles.setChip, setFilter === null && styles.setChipActive]}>
            <Text style={[styles.setChipText, setFilter === null && styles.setChipTextActive]}>Tous</Text>
          </Pressable>
          {setOptions.map(s => (
            <Pressable key={s.id} onPress={() => setSetFilter(s.id)} style={[styles.setChip, setFilter === s.id && styles.setChipActive]}>
              <Text style={[styles.setChipText, setFilter === s.id && styles.setChipTextActive]} numberOfLines={1}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </>
  );

  return (
    <BubbleSheet visible={target !== null} onClose={onClose} tint={TINT} title={title}>
      {myLoading || friendLoading ? (
        <ActivityIndicator style={{ margin: spacing.xl }} />
      ) : step === 'offer' ? (
        offerCandidates.length === 0 ? (
          <Text style={styles.empty}>Tu ne possèdes aucune carte pour l’instant.</Text>
        ) : (
          <>
            <Text style={styles.hint}>
              {offerMatches.length > 0
                ? `Ces cartes sont dans la wishlist de ${target?.displayName}.`
                : 'Choisis une carte à proposer — les cartes marquées "unique" sont ta seule copie.'}
            </Text>
            {renderSearchAndFilters(offerSetOptions)}
            {filteredOfferCandidates.length === 0 ? (
              <Text style={styles.empty}>Aucune carte ne correspond à cette recherche.</Text>
            ) : (
              renderList(filteredOfferCandidates, pickOffered, friendWishlistIds, myQuantities)
            )}
          </>
        )
      ) : step === 'request' ? (
        requestCandidates.length === 0 ? (
          <Text style={styles.empty}>{target?.displayName} n’a aucun doublon à te proposer en retour pour l’instant.</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
              <Pressable onPress={() => { setOfferedCard(null); setSearch(''); setSetFilter(null); }} hitSlop={8} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={TINT} />
              </Pressable>
              <Text style={styles.hint}>Les cartes marquées ★ sont dans ta wishlist.</Text>
            </View>
            {renderSearchAndFilters(requestSetOptions)}
            {filteredRequestCandidates.length === 0 ? (
              <Text style={styles.empty}>Aucune carte ne correspond à cette recherche.</Text>
            ) : (
              renderList(filteredRequestCandidates, pickRequested, myWishlistIds)
            )}
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
          {(myQuantities.get(offeredCard!.cardId) ?? 0) < 2 && (
            <Text style={styles.uniqueWarning}>C’est ta seule copie — tu ne l’auras plus après l’échange.</Text>
          )}
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
          <Pressable onPress={() => { setRequestedCard(null); setSearch(''); setSetFilter(null); }}>
            <Text style={styles.hint}>Changer la carte demandée</Text>
          </Pressable>
        </View>
      )}
    </BubbleSheet>
  );
}
