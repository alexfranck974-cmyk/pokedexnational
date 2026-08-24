import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';
import type { Locale } from './locale';

export interface TradeCard {
  id: string;
  name: string;
  imageSmall: string;
  imageLarge: string | null;
  cardmarketTrendEur: number | null;
}

const EUR_FORMATTERS: Record<Locale, Intl.NumberFormat> = {
  fr: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }),
  en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }),
};
export function eurFormatter(locale: Locale = 'fr'): Intl.NumberFormat {
  return EUR_FORMATTERS[locale];
}

export interface TradeOfferItem {
  id: string;
  direction: 'incoming' | 'outgoing';
  counterpartyId: string;
  counterpartyName: string;
  offeredCard: TradeCard;
  requestedCard: TradeCard;
  createdAt: string;
}

export interface TradeInProgressItem extends TradeOfferItem {
  myConfirmed: boolean;
  counterpartyConfirmed: boolean;
}

export interface CompletedTradeItem {
  id: string;
  counterpartyName: string;
  gaveCard: TradeCard;
  receivedCard: TradeCard;
  completedAt: string;
}

const CARD_FIELDS = 'id, name, image_small, image_large, cardmarket_trend_eur';

function toTradeCard(row: any): TradeCard {
  return {
    id: row?.id ?? '',
    name: row?.name ?? '',
    imageSmall: row?.image_small ?? '',
    imageLarge: row?.image_large ?? null,
    cardmarketTrendEur: row?.cardmarket_trend_eur ?? null,
  };
}

// Pending offers where the user is either side, oldest first.
export function usePendingTradeOffers(userId?: string) {
  return useQuery({
    queryKey: ['trade_offers', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_offers')
        .select(`
          id, proposer_id, receiver_id, created_at,
          proposer:profiles!trade_offers_proposer_id_fkey(username, display_name),
          receiver:profiles!trade_offers_receiver_id_fkey(username, display_name),
          offered:tcg_cards!trade_offers_offered_card_id_fkey(${CARD_FIELDS}),
          requested:tcg_cards!trade_offers_requested_card_id_fkey(${CARD_FIELDS})
        `)
        .eq('status', 'pending')
        .or(`proposer_id.eq.${userId!},receiver_id.eq.${userId!}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => row.offered && row.requested)
        .map((row: any): TradeOfferItem => {
          const outgoing = row.proposer_id === userId;
          const counterparty = outgoing ? row.receiver : row.proposer;
          return {
            id: row.id,
            direction: outgoing ? 'outgoing' : 'incoming',
            counterpartyId: outgoing ? row.receiver_id : row.proposer_id,
            counterpartyName: counterparty?.display_name || counterparty?.username || '?',
            offeredCard: toTradeCard(row.offered),
            requestedCard: toTradeCard(row.requested),
            createdAt: row.created_at,
          };
        });
    },
  });
}

// Accepted offers where the real-world exchange hasn't been confirmed by both
// sides yet — drives the spinning-Pokéball "in progress" indicator.
export function useInProgressTradeOffers(userId?: string) {
  return useQuery({
    queryKey: ['trade_offers_in_progress', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_offers')
        .select(`
          id, proposer_id, receiver_id, created_at, proposer_confirmed_at, receiver_confirmed_at,
          proposer:profiles!trade_offers_proposer_id_fkey(username, display_name),
          receiver:profiles!trade_offers_receiver_id_fkey(username, display_name),
          offered:tcg_cards!trade_offers_offered_card_id_fkey(${CARD_FIELDS}),
          requested:tcg_cards!trade_offers_requested_card_id_fkey(${CARD_FIELDS})
        `)
        .eq('status', 'in_progress')
        .or(`proposer_id.eq.${userId!},receiver_id.eq.${userId!}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => row.offered && row.requested)
        .map((row: any): TradeInProgressItem => {
          const outgoing = row.proposer_id === userId;
          const counterparty = outgoing ? row.receiver : row.proposer;
          return {
            id: row.id,
            direction: outgoing ? 'outgoing' : 'incoming',
            counterpartyId: outgoing ? row.receiver_id : row.proposer_id,
            counterpartyName: counterparty?.display_name || counterparty?.username || '?',
            offeredCard: toTradeCard(row.offered),
            requestedCard: toTradeCard(row.requested),
            createdAt: row.created_at,
            myConfirmed: outgoing ? !!row.proposer_confirmed_at : !!row.receiver_confirmed_at,
            counterpartyConfirmed: outgoing ? !!row.receiver_confirmed_at : !!row.proposer_confirmed_at,
          };
        });
    },
  });
}

export function useProposeTrade() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ receiverId, offeredCardId, requestedCardId }: {
      receiverId: string; offeredCardId: string; requestedCardId: string;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('trade_offers').insert({
        proposer_id: userId, receiver_id: receiverId,
        offered_card_id: offeredCardId, requested_card_id: requestedCardId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trade_offers', userId] }),
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('offered_card_already_committed')) {
        toast('Cette carte est déjà engagée dans un autre échange en cours.');
      } else if (message.includes('proposer_does_not_own_offered_card')) {
        toast('Tu ne possèdes plus cette carte.');
      } else {
        toast('Impossible de proposer cet échange, réessaie.');
      }
    },
  });
}

function useInvalidateAfterTrade() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return () => {
    qc.invalidateQueries({ queryKey: ['trade_offers', userId] });
    qc.invalidateQueries({ queryKey: ['trade_offers_in_progress', userId] });
    qc.invalidateQueries({ queryKey: ['owned_card_quantities', userId] });
    qc.invalidateQueries({ queryKey: ['all_owned_card_ids', userId] });
    qc.invalidateQueries({ queryKey: ['owned_dex_nums', userId] });
    qc.invalidateQueries({ queryKey: ['all_owned_cards_ledger_detailed', userId] });
    qc.invalidateQueries({ queryKey: ['completed_trades_count', userId] });
  };
}

// Marks the offer in_progress — no cards move yet, see confirm_trade_exchange.
export function useAcceptTrade() {
  const invalidate = useInvalidateAfterTrade();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.rpc('accept_trade_offer', { p_offer_id: offerId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Cet échange n’est plus disponible.'),
  });
}

// Records this side's real-world-exchange confirmation; the swap only
// actually executes server-side once both sides have called this.
export function useConfirmTradeExchange() {
  const invalidate = useInvalidateAfterTrade();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.rpc('confirm_trade_exchange', { p_offer_id: offerId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de confirmer cet échange, réessaie.'),
  });
}

export function useDeclineTrade() {
  const invalidate = useInvalidateAfterTrade();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.from('trade_offers').update({ status: 'declined' }).eq('id', offerId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de refuser cet échange, réessaie.'),
  });
}

export function useCancelTrade() {
  const invalidate = useInvalidateAfterTrade();
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.from('trade_offers').update({ status: 'cancelled' }).eq('id', offerId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible d’annuler cet échange, réessaie.'),
  });
}

export interface FriendCardListing {
  friendId: string;
  friendName: string;
  card: TradeCard;
}

// Every accepted friend's duplicate (quantity >= 2) — the "available" half of the
// marketplace. Auto-derived from user_owned_cards.quantity, no manual flagging:
// a card becomes "available" the moment a second copy is logged.
export function useFriendsAvailableCards(friendIds: string[]) {
  const key = [...friendIds].sort().join(',');
  return useQuery({
    queryKey: ['friends_available_cards', key],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select(`
          user_id,
          owner:profiles!user_owned_cards_user_id_fkey(username, display_name),
          card:tcg_cards(${CARD_FIELDS})
        `)
        .in('user_id', friendIds)
        .eq('finish', 'normal') // trades only move normal-finish copies (see migration 046)
        .gte('quantity', 2);
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => row.card)
        .map((row: any): FriendCardListing => ({
          friendId: row.user_id,
          friendName: row.owner?.display_name || row.owner?.username || '?',
          card: toTradeCard(row.card),
        }));
    },
  });
}

// Every accepted friend's wishlist item — the "wanted" half of the marketplace,
// and also what the instant "échange possible" match check looks up against.
export function useFriendsWantedCards(friendIds: string[]) {
  const key = [...friendIds].sort().join(',');
  return useQuery({
    queryKey: ['friends_wanted_cards', key],
    enabled: friendIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wishlist')
        .select(`
          user_id,
          owner:profiles!user_wishlist_user_id_fkey(username, display_name),
          card:tcg_cards(${CARD_FIELDS})
        `)
        .in('user_id', friendIds);
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => row.card)
        .map((row: any): FriendCardListing => ({
          friendId: row.user_id,
          friendName: row.owner?.display_name || row.owner?.username || '?',
          card: toTradeCard(row.card),
        }));
    },
  });
}

// Trade opportunities across the whole friend list — cards a friend wants that I
// can fulfill from a duplicate, plus cards a friend has spare that sit on my own
// wishlist. One-directional in each term (not a strict mutual-swap requirement),
// matching how the Marché tab's own per-row "canFulfill" check already works —
// just aggregated into a count instead of per-row disabled state. Feeds the
// floating trade bubble's badge in app/(app)/_layout.tsx.
export function countMarketMatches(
  availableCards: FriendCardListing[],
  wantedCards: FriendCardListing[],
  myWishedIds: Set<string>,
  myDuplicateIds: Set<string>,
): number {
  const iCanFulfill = wantedCards.filter(w => myDuplicateIds.has(w.card.id)).length;
  const friendsHaveWhatIWant = availableCards.filter(a => myWishedIds.has(a.card.id)).length;
  return iCanFulfill + friendsHaveWhatIWant;
}

// Completed trades (both sides confirmed the real-world exchange) the user
// took part in either side of — feeds the Dashboard ring and trade-count badges.
export function useCompletedTradesCount(userId?: string) {
  return useQuery({
    queryKey: ['completed_trades_count', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('trade_offers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .or(`proposer_id.eq.${userId!},receiver_id.eq.${userId!}`);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// Full completed-trade history for the Dashboard "Échanges" ring — most
// recent first, framed from the viewer's side (gaveCard/receivedCard rather
// than offered/requested, which are proposer/receiver-relative in storage).
export function useCompletedTradeOffers(userId?: string) {
  return useQuery({
    queryKey: ['completed_trade_offers', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_offers')
        .select(`
          id, proposer_id, receiver_id, completed_at,
          proposer:profiles!trade_offers_proposer_id_fkey(username, display_name),
          receiver:profiles!trade_offers_receiver_id_fkey(username, display_name),
          offered:tcg_cards!trade_offers_offered_card_id_fkey(${CARD_FIELDS}),
          requested:tcg_cards!trade_offers_requested_card_id_fkey(${CARD_FIELDS})
        `)
        .eq('status', 'completed')
        .or(`proposer_id.eq.${userId!},receiver_id.eq.${userId!}`)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => row.offered && row.requested)
        .map((row: any): CompletedTradeItem => {
          const wasProposer = row.proposer_id === userId;
          const counterparty = wasProposer ? row.receiver : row.proposer;
          return {
            id: row.id,
            counterpartyName: counterparty?.display_name || counterparty?.username || '?',
            gaveCard: toTradeCard(wasProposer ? row.offered : row.requested),
            receivedCard: toTradeCard(wasProposer ? row.requested : row.offered),
            completedAt: row.completed_at,
          };
        });
    },
  });
}
