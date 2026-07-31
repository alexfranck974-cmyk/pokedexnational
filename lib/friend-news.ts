import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { classifyRarity } from './rarity-tiers';

// Single fixed reaction (user's choice — a "bravo" tap, not a multi-emoji picker).
export const BRAVO_EMOJI = '👏';

// Called from the ownership mutations in lib/collection.ts right after a card is
// newly marked owned. Only chase-tier pulls ("uniquement notable", per the user's
// own choice) generate news — silently skips everything else. Never throws: a
// failed news post shouldn't block the card save it's piggybacking on.
export async function postFriendNewsIfNotable(userId: string, cardId: string, rarity: string | null) {
  if (classifyRarity(rarity) !== 'chase' || !rarity) return;
  const { error } = await supabase.from('friend_news').insert({ user_id: userId, card_id: cardId, rarity_label: rarity });
  if (error) console.warn('friend_news insert failed', error);
}

export interface FriendNewsItem {
  id: string;
  authorId: string;
  authorName: string;
  cardId: string;
  cardName: string;
  imageSmall: string;
  imageLarge: string | null;
  rarityLabel: string;
  createdAt: string;
  dexNum: number;
  setId: string;
  setName: string;
  cardNumber: string;
}

const FRIEND_NEWS_SELECT =
  'id, user_id, card_id, rarity_label, created_at, author:profiles!friend_news_user_id_fkey(username, display_name), card:tcg_cards(name, image_small, image_large, dex_num, set_id, set_name, card_number)';

function mapFriendNewsRow(row: any): FriendNewsItem {
  return {
    id: row.id,
    authorId: row.user_id,
    authorName: row.author?.display_name || row.author?.username || '?',
    cardId: row.card_id,
    cardName: row.card?.name ?? '',
    imageSmall: row.card?.image_small ?? '',
    imageLarge: row.card?.image_large ?? null,
    rarityLabel: row.rarity_label,
    createdAt: row.created_at,
    dexNum: row.card?.dex_num ?? 0,
    setId: row.card?.set_id ?? '',
    setName: row.card?.set_name ?? '',
    cardNumber: row.card?.card_number ?? '',
  };
}

// Undismissed news from accepted friends, oldest first (so the pop-up queue plays
// in the order things happened). RLS on friend_news already scopes rows to
// "mine or an accepted friend's" — this just excludes my own and already-seen ones.
// Short staleTime so it actually refetches on each app foreground (the global
// refetchOnWindowFocus + AppState wiring in app/_layout.tsx) rather than serving
// a 5-minute-stale empty result.
export function useFriendNewsFeed(userId?: string) {
  return useQuery({
    queryKey: ['friend_news_feed', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_news')
        .select(`${FRIEND_NEWS_SELECT}, dismissed:friend_news_dismissed(user_id)`)
        .neq('user_id', userId!)
        .order('created_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => (row.dismissed?.length ?? 0) === 0 && row.card)
        .map(mapFriendNewsRow);
    },
  });
}

// Past news — includes already-dismissed rows (the live feed above excludes
// them), so a friend's earlier pulls stay browsable instead of vanishing once
// seen. Most-recent-first (a browsable log, not a queue to clear), and only
// queried while the history sheet is actually open (`enabled`) since it isn't
// time-critical the way the live feed is.
export function useFriendNewsHistory(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ['friend_news_history', userId],
    enabled: !!userId && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_news')
        .select(FRIEND_NEWS_SELECT)
        .neq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter((row: any) => row.card).map(mapFriendNewsRow);
    },
  });
}

export function useDismissFriendNews() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (newsId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('friend_news_dismissed').insert({ news_id: newsId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend_news_feed', userId] });
      qc.invalidateQueries({ queryKey: ['friend_news_history', userId] });
    },
  });
}

export function useReactToFriendNews() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (newsId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('friend_news_reactions')
        .upsert({ news_id: newsId, user_id: userId, emoji: BRAVO_EMOJI }, { onConflict: 'news_id,user_id' });
      if (error) throw error;
    },
  });
}
