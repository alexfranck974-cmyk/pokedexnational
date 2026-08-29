import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface LeaderboardEntry {
  userId: string;
  dexCount: number;
  activeThisWeek: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Both stats are already friend-visible via existing RLS (user_dex inherits
// user_cards' friend policy; user_owned_cards has its own) — no new
// migration needed. Deliberately scoped to what's cheaply available today:
// trade-count ranking would need a new RLS policy (trade_offers is
// party-only), and a real login/activity streak isn't persisted anywhere
// yet (the "date-streak" badge is a client-side derivation, not a
// per-friend-queryable stat) — both left for a later pass.
export function useFriendLeaderboard(userIds: string[]) {
  const key = [...userIds].sort().join(',');
  return useQuery({
    queryKey: ['friend_leaderboard', key],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
      const entries = await Promise.all(userIds.map(async (userId): Promise<LeaderboardEntry> => {
        const [{ count: dexCount }, { count: recentCount }] = await Promise.all([
          supabase.from('user_dex').select('dex_num', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('user_owned_cards').select('card_id', { count: 'exact', head: true }).eq('user_id', userId).gte('acquired_at', sinceIso),
        ]);
        return { userId, dexCount: dexCount ?? 0, activeThisWeek: (recentCount ?? 0) > 0 };
      }));
      return entries.sort((a, b) => b.dexCount - a.dexCount);
    },
  });
}
