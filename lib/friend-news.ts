import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { classifyRarity } from './rarity-tiers';

export const NEWS_REACTIONS = ['🔥', '😍', '🤯', '👏'] as const;
export type NewsReaction = typeof NEWS_REACTIONS[number];

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
        .select('id, user_id, card_id, rarity_label, created_at, author:profiles!friend_news_user_id_fkey(username, display_name), card:tcg_cards(name, image_small, image_large), dismissed:friend_news_dismissed(user_id)')
        .neq('user_id', userId!)
        .order('created_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? [])
        .filter((row: any) => (row.dismissed?.length ?? 0) === 0 && row.card)
        .map((row: any): FriendNewsItem => ({
          id: row.id,
          authorId: row.user_id,
          authorName: row.author?.display_name || row.author?.username || '?',
          cardId: row.card_id,
          cardName: row.card?.name ?? '',
          imageSmall: row.card?.image_small ?? '',
          imageLarge: row.card?.image_large ?? null,
          rarityLabel: row.rarity_label,
          createdAt: row.created_at,
        }));
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend_news_feed', userId] }),
  });
}

export function useReactToFriendNews() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ newsId, emoji }: { newsId: string; emoji: NewsReaction }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('friend_news_reactions')
        .upsert({ news_id: newsId, user_id: userId, emoji }, { onConflict: 'news_id,user_id' });
      if (error) throw error;
    },
  });
}
