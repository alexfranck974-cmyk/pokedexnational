import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export function useFavorites(userId?: string) {
  return useQuery({
    queryKey: ['favorites', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('dex_num')
        .eq('user_id', userId!)
        .order('favorited_at', { ascending: false });
      if (error) throw error;
      // Set preserves insertion order, so iterating this Set yields most-recently-favorited first.
      return new Set<number>((data ?? []).map(r => r.dex_num as number));
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ dexNum, currentlyFavorited }: { dexNum: number; currentlyFavorited: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyFavorited) {
        const { error } = await supabase.from('user_favorites').delete().eq('user_id', userId).eq('dex_num', dexNum);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_favorites').insert({ user_id: userId, dex_num: dexNum });
        if (error) throw error;
      }
    },
    onMutate: async ({ dexNum, currentlyFavorited }) => {
      await qc.cancelQueries({ queryKey: ['favorites', userId] });
      const prev = qc.getQueryData<Set<number>>(['favorites', userId]);
      const next = new Set(prev ?? []);
      if (currentlyFavorited) next.delete(dexNum); else next.add(dexNum);
      qc.setQueryData(['favorites', userId], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['favorites', userId], ctx.prev);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites', userId] });
    },
  });
}
