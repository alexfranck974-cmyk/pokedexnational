import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// Single subscription point for the whole authenticated session — mounted once
// from app/(app)/_layout.tsx rather than inside each individual hook, so
// screens like friends.tsx that call useFriendNewsFeed/usePendingTradeOffers/
// useIncomingRequests again don't open duplicate websocket channels on top of
// the layout's own instance of those hooks.
//
// Each handler only invalidates an existing React Query key — it never reads
// the event payload directly, so this stays safe even if a client ever
// received an event for a row it isn't allowed to see: the refetch that
// follows is still a normal RLS-protected SELECT.
export function useSocialRealtime(userId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`social:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_news' }, () => {
        qc.invalidateQueries({ queryKey: ['friend_news_feed', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_offers' }, () => {
        qc.invalidateQueries({ queryKey: ['trade_offers', userId] });
        qc.invalidateQueries({ queryKey: ['completed_trades_count', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        qc.invalidateQueries({ queryKey: ['friends', userId] });
        qc.invalidateQueries({ queryKey: ['friend_requests_incoming', userId] });
        qc.invalidateQueries({ queryKey: ['friend_requests_outgoing', userId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);
}
