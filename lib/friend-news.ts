import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { classifyRarity } from './rarity-tiers';

// Single fixed reaction (user's choice — a "bravo" tap, not a multi-emoji picker).
export const BRAVO_EMOJI = '👏';

export type FriendNewsEventType = 'chase_card' | 'sealed_product' | 'trade_completed' | 'binder_completed' | 'set_goal_completed';

// Called from the ownership mutations in lib/collection.ts right after a card is
// newly marked owned. Only chase-tier pulls ("uniquement notable", per the user's
// own choice) generate news — silently skips everything else. Never throws: a
// failed news post shouldn't block the card save it's piggybacking on.
export async function postFriendNewsIfNotable(userId: string, cardId: string, rarity: string | null) {
  if (classifyRarity(rarity) !== 'chase' || !rarity) return;
  const { error } = await supabase.from('friend_news').insert({ user_id: userId, card_id: cardId, rarity_label: rarity, event_type: 'chase_card' });
  if (error) console.warn('friend_news insert failed', error);
}

// Called from useAdjustSealedProduct (lib/sealed-products.ts) on a genuine
// 0 -> N transition — every first-of-a-kind sealed product is notable, unlike
// cards there's no rarity gate to apply. Never throws, same reasoning as above.
export async function postSealedProductNewsIfNotable(userId: string, setId: string, setName: string, productType: string) {
  const { error } = await supabase.from('friend_news').insert({
    user_id: userId, event_type: 'sealed_product',
    sealed_set_id: setId, sealed_set_name: setName, sealed_product_type: productType,
  });
  if (error) console.warn('friend_news insert failed', error);
}

// Binder/set-goal completion is only ever computed client-side today (no
// server-side single point of truth), so these guard against re-posting on
// every re-render/re-open by checking for a prior post first. Safe to call
// from a UI effect whenever the already-computed completion value is seen
// true — not a hot path, one extra SELECT.
export async function postBinderCompletedNewsIfNotable(userId: string, binderId: string, binderName: string) {
  const { data: existing, error: selErr } = await supabase
    .from('friend_news').select('id').eq('user_id', userId).eq('event_type', 'binder_completed').eq('binder_id', binderId).limit(1);
  if (selErr) { console.warn('friend_news existence check failed', selErr); return; }
  if (existing && existing.length > 0) return;
  const { error } = await supabase.from('friend_news').insert({ user_id: userId, event_type: 'binder_completed', binder_id: binderId, binder_name: binderName });
  if (error) console.warn('friend_news insert failed', error);
}

export async function postSetGoalCompletedNewsIfNotable(userId: string, setId: string, setName: string) {
  const { data: existing, error: selErr } = await supabase
    .from('friend_news').select('id').eq('user_id', userId).eq('event_type', 'set_goal_completed').eq('set_goal_set_id', setId).limit(1);
  if (selErr) { console.warn('friend_news existence check failed', selErr); return; }
  if (existing && existing.length > 0) return;
  const { error } = await supabase.from('friend_news').insert({ user_id: userId, event_type: 'set_goal_completed', set_goal_set_id: setId, set_goal_set_name: setName });
  if (error) console.warn('friend_news insert failed', error);
}

export interface FriendNewsItem {
  id: string;
  eventType: FriendNewsEventType;
  authorId: string;
  authorName: string;
  createdAt: string;
  reactionCount: number;
  // chase_card only
  cardId: string | null;
  cardName: string;
  imageSmall: string;
  imageLarge: string | null;
  rarityLabel: string;
  dexNum: number;
  setId: string;
  setName: string;
  cardNumber: string;
  // sealed_product only
  sealedSetId: string | null;
  sealedSetName: string | null;
  sealedProductType: string | null;
  // trade_completed only
  tradeOfferId: string | null;
  // binder_completed only
  binderId: string | null;
  binderName: string | null;
  // set_goal_completed only
  setGoalSetId: string | null;
  setGoalSetName: string | null;
}

const FRIEND_NEWS_SELECT =
  'id, user_id, event_type, card_id, rarity_label, created_at, sealed_set_id, sealed_set_name, sealed_product_type, trade_offer_id, binder_id, binder_name, set_goal_set_id, set_goal_set_name, author:profiles!friend_news_user_id_fkey(username, display_name), card:tcg_cards(name, image_small, image_large, dex_num, set_id, set_name, card_number), reactions:friend_news_reactions(emoji)';

// chase_card is the only type whose row is unusable without its card join
// resolving (the card could since have been removed from tcg_cards) — every
// other event type carries all the data it needs directly on the row.
function isValidNewsRow(row: any): boolean {
  return row.event_type !== 'chase_card' || !!row.card;
}

function mapFriendNewsRow(row: any): FriendNewsItem {
  return {
    id: row.id,
    eventType: row.event_type as FriendNewsEventType,
    authorId: row.user_id,
    authorName: row.author?.display_name || row.author?.username || '?',
    createdAt: row.created_at,
    reactionCount: row.reactions?.length ?? 0,
    cardId: row.card_id,
    cardName: row.card?.name ?? '',
    imageSmall: row.card?.image_small ?? '',
    imageLarge: row.card?.image_large ?? null,
    rarityLabel: row.rarity_label ?? '',
    dexNum: row.card?.dex_num ?? 0,
    setId: row.card?.set_id ?? '',
    setName: row.card?.set_name ?? '',
    cardNumber: row.card?.card_number ?? '',
    sealedSetId: row.sealed_set_id,
    sealedSetName: row.sealed_set_name,
    sealedProductType: row.sealed_product_type,
    tradeOfferId: row.trade_offer_id,
    binderId: row.binder_id,
    binderName: row.binder_name,
    setGoalSetId: row.set_goal_set_id,
    setGoalSetName: row.set_goal_set_name,
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
        .filter((row: any) => (row.dismissed?.length ?? 0) === 0 && isValidNewsRow(row))
        .map(mapFriendNewsRow);
    },
  });
}

const HISTORY_PAGE_SIZE = 20;

// Past news — includes already-dismissed rows (the live feed above excludes
// them), so a friend's earlier activity stays browsable instead of vanishing
// once seen. Most-recent-first (a browsable log, not a queue to clear).
// Cursor-paginated on created_at (first useInfiniteQuery in this codebase) —
// only queried while the history sheet is actually open (`enabled`).
export function useFriendNewsHistory(userId?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['friend_news_history', userId],
    enabled: !!userId && enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      let query = supabase
        .from('friend_news')
        .select(FRIEND_NEWS_SELECT)
        .neq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(HISTORY_PAGE_SIZE);
      if (pageParam) query = query.lt('created_at', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      const items = (data ?? []).filter(isValidNewsRow).map(mapFriendNewsRow);
      return { items, nextCursor: items.length === HISTORY_PAGE_SIZE ? items[items.length - 1].createdAt : null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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
  const qc = useQueryClient();
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend_news_feed', userId] });
      qc.invalidateQueries({ queryKey: ['friend_news_history', userId] });
    },
  });
}
