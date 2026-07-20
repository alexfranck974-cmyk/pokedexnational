import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export function useUserDex(userId?: string) {
  return useQuery({
    queryKey: ['user_dex', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_dex').select('dex_num').eq('user_id', userId!);
      if (error) throw error;
      return new Set<number>((data ?? []).map(r => r.dex_num as number));
    },
  });
}

export function useUserCards(userId: string | undefined, dexNum: number | undefined) {
  return useQuery({
    queryKey: ['user_cards', userId, dexNum],
    enabled: !!userId && !!dexNum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('card_id, tcg_cards!inner(dex_num)')
        .eq('user_id', userId!)
        .eq('tcg_cards.dex_num', dexNum!);
      if (error) throw error;
      return new Set<string>((data ?? []).map(r => r.card_id as string));
    },
  });
}

export function useToggleCard() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ cardId, currentlyOwned }: { cardId: string; currentlyOwned: boolean; dexNum: number }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyOwned) {
        const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_cards').insert({ user_id: userId, card_id: cardId });
        if (error) throw error;
      }
    },
    onMutate: async ({ cardId, currentlyOwned, dexNum }) => {
      await qc.cancelQueries({ queryKey: ['user_cards', userId, dexNum] });
      await qc.cancelQueries({ queryKey: ['user_dex', userId] });

      const prevCards = qc.getQueryData<Set<string>>(['user_cards', userId, dexNum]);
      const prevDex   = qc.getQueryData<Set<number>>(['user_dex', userId]);

      const nextCards = new Set(prevCards ?? []);
      if (currentlyOwned) nextCards.delete(cardId); else nextCards.add(cardId);
      qc.setQueryData(['user_cards', userId, dexNum], nextCards);

      const nextDex = new Set(prevDex ?? []);
      if (nextCards.size > 0) nextDex.add(dexNum); else nextDex.delete(dexNum);
      qc.setQueryData(['user_dex', userId], nextDex);

      return { prevCards, prevDex };
    },
    onError: (_e, { dexNum }, ctx) => {
      if (ctx?.prevCards) qc.setQueryData(['user_cards', userId, dexNum], ctx.prevCards);
      if (ctx?.prevDex)   qc.setQueryData(['user_dex', userId], ctx.prevDex);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: (_r, _e, { dexNum }) => {
      qc.invalidateQueries({ queryKey: ['user_cards', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['user_dex', userId] });
    },
  });
}
