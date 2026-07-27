import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export interface SetGoal {
  setId: string;
  pinnedAt: string;
}

export function useSetGoals(userId?: string) {
  return useQuery({
    queryKey: ['set_goals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_set_goals')
        .select('set_id, pinned_at')
        .eq('user_id', userId!)
        .order('pinned_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(r => ({
        setId: r.set_id as string,
        pinnedAt: r.pinned_at as string,
      })) as SetGoal[];
    },
  });
}

export function useToggleSetGoal() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ setId, currentlyPinned }: { setId: string; currentlyPinned: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyPinned) {
        const { error } = await supabase.from('user_set_goals').delete().eq('user_id', userId).eq('set_id', setId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_set_goals').insert({ user_id: userId, set_id: setId });
        if (error) throw error;
      }
    },
    onMutate: async ({ setId, currentlyPinned }) => {
      await qc.cancelQueries({ queryKey: ['set_goals', userId] });
      const prev = qc.getQueryData<SetGoal[]>(['set_goals', userId]);
      const next = currentlyPinned
        ? (prev ?? []).filter(g => g.setId !== setId)
        : [{ setId, pinnedAt: new Date().toISOString() }, ...(prev ?? [])];
      qc.setQueryData(['set_goals', userId], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['set_goals', userId], ctx.prev);
      toast('Impossible de mettre à jour tes objectifs, réessaie.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['set_goals', userId] });
    },
  });
}

export function useSetGoalProgress(userId: string | undefined, setId: string | undefined) {
  return useQuery({
    queryKey: ['set_goal_progress', userId, setId],
    enabled: !!userId && !!setId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id, tcg_cards!inner(set_id)')
        .eq('user_id', userId!)
        .eq('tcg_cards.set_id', setId!);
      if (error) throw error;
      return (data ?? []).length;
    },
  });
}
