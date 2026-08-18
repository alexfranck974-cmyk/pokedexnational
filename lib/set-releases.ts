import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';

export interface SetRelease {
  setId: string;
  setName: string;
  region: string;
  releaseDate: string | null;
  announcedAt: string;
}

// Every announced set (populated by the announce_new_set trigger, see migration
// 048) the current user hasn't dismissed yet, newest first. Existing users are
// bulk-dismissed against the whole pre-migration catalog (049), so in practice
// only genuinely new sets synced from here on show up for them — but a user
// who *signs up* after 048/049 ran would still have zero dismissal rows
// against those ~222 backfilled entries, so this also drops anything
// announced before the user joined (a set they couldn't possibly have missed
// as "new", by definition) as a second, structural safety net against the
// same flood.
export function useUndismissedSetReleases(userId?: string, joinedAt?: string) {
  return useQuery({
    queryKey: ['set_releases_undismissed', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [releasesRes, dismissedRes] = await Promise.all([
        supabase.from('set_releases').select('set_id, set_name, region, release_date, announced_at').order('announced_at', { ascending: false }),
        supabase.from('set_releases_dismissed').select('set_id').eq('user_id', userId!),
      ]);
      if (releasesRes.error) throw releasesRes.error;
      if (dismissedRes.error) throw dismissedRes.error;
      const dismissedIds = new Set((dismissedRes.data ?? []).map(r => r.set_id as string));
      const joinedAtMs = joinedAt ? new Date(joinedAt).getTime() : 0;
      return (releasesRes.data ?? [])
        .filter(r => !dismissedIds.has(r.set_id as string) && new Date(r.announced_at as string).getTime() > joinedAtMs)
        .map((r): SetRelease => ({
          setId: r.set_id as string,
          setName: r.set_name as string,
          region: r.region as string,
          releaseDate: (r.release_date as string | null) ?? null,
          announcedAt: r.announced_at as string,
        }));
    },
  });
}

export function useDismissSetRelease() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (setId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('set_releases_dismissed').insert({ set_id: setId, user_id: userId });
      if (error) throw error;
    },
    onMutate: async (setId: string) => {
      await qc.cancelQueries({ queryKey: ['set_releases_undismissed', userId] });
      const prev = qc.getQueryData<SetRelease[]>(['set_releases_undismissed', userId]);
      qc.setQueryData<SetRelease[]>(['set_releases_undismissed', userId], (prev ?? []).filter(r => r.setId !== setId));
      return { prev };
    },
    onError: (_e, _setId, ctx) => {
      if (ctx?.prev) qc.setQueryData(['set_releases_undismissed', userId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['set_releases_undismissed', userId] });
    },
  });
}
