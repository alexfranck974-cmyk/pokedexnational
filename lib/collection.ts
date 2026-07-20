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
    mutationFn: async ({
      cardId, currentlyOwned,
    }: { cardId: string; currentlyOwned: boolean; dexNum: number; imageSmall: string }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyOwned) {
        const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
      } else {
        // Upsert replaces any existing card for the same (user_id, dex_num) via trigger + PK.
        const { error } = await supabase
          .from('user_cards')
          .upsert({ user_id: userId, card_id: cardId }, { onConflict: 'user_id,dex_num' });
        if (error) throw error;
      }
    },
    onMutate: async ({ cardId, currentlyOwned, dexNum, imageSmall }) => {
      await qc.cancelQueries({ queryKey: ['user_cards', userId, dexNum] });
      await qc.cancelQueries({ queryKey: ['user_dex', userId] });
      await qc.cancelQueries({ queryKey: ['owned_card_images', userId] });

      const prevCards = qc.getQueryData<Set<string>>(['user_cards', userId, dexNum]);
      const prevDex = qc.getQueryData<Set<number>>(['user_dex', userId]);
      const prevImages = qc.getQueryData<Map<number, string>>(['owned_card_images', userId]);

      const nextCards = new Set(prevCards ?? []);
      if (currentlyOwned) {
        nextCards.delete(cardId);
      } else {
        nextCards.clear();
        nextCards.add(cardId);
      }
      qc.setQueryData(['user_cards', userId, dexNum], nextCards);

      const nextDex = new Set(prevDex ?? []);
      if (nextCards.size > 0) nextDex.add(dexNum); else nextDex.delete(dexNum);
      qc.setQueryData(['user_dex', userId], nextDex);

      const nextImages = new Map(prevImages ?? []);
      if (nextCards.size > 0) nextImages.set(dexNum, imageSmall);
      else nextImages.delete(dexNum);
      qc.setQueryData(['owned_card_images', userId], nextImages);

      return { prevCards, prevDex, prevImages };
    },
    onError: (_e, { dexNum }, ctx) => {
      if (ctx?.prevCards) qc.setQueryData(['user_cards', userId, dexNum], ctx.prevCards);
      if (ctx?.prevDex) qc.setQueryData(['user_dex', userId], ctx.prevDex);
      if (ctx?.prevImages) qc.setQueryData(['owned_card_images', userId], ctx.prevImages);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: (_r, _e, { dexNum }) => {
      qc.invalidateQueries({ queryKey: ['user_cards', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['user_dex', userId] });
      qc.invalidateQueries({ queryKey: ['owned_card_images', userId] });
    },
  });
}

export function useOwnedCardImages(userId?: string) {
  return useQuery({
    queryKey: ['owned_card_images', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('dex_num, card_id, tcg_cards!inner(image_small)')
        .eq('user_id', userId!);
      if (error) throw error;
      const map = new Map<number, string>();
      for (const row of data ?? []) {
        const img = (row.tcg_cards as any)?.image_small as string | undefined;
        if (img) map.set(row.dex_num as number, img);
      }
      return map;
    },
  });
}

export function useUserWishlist(userId: string | undefined, dexNum: number | undefined) {
  return useQuery({
    queryKey: ['user_wishlist', userId, dexNum],
    enabled: !!userId && !!dexNum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wishlist')
        .select('card_id, tcg_cards!inner(dex_num)')
        .eq('user_id', userId!)
        .eq('tcg_cards.dex_num', dexNum!);
      if (error) throw error;
      return new Set<string>((data ?? []).map(r => r.card_id as string));
    },
  });
}

export function useAllWishedCards(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_wishlist_all', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wishlist')
        .select('card_id, wished_at, tcg_cards(id, name, dex_num, set_id, set_name, card_number, rarity, image_small, image_large, release_date)')
        .eq('user_id', userId!)
        .order('wished_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map(r => r.tcg_cards)
        .filter((c): c is NonNullable<typeof c> => c != null);
    },
  });
}

export function useToggleWish() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ cardId, currentlyWished }: { cardId: string; currentlyWished: boolean; dexNum: number }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyWished) {
        const { error } = await supabase.from('user_wishlist').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_wishlist').insert({ user_id: userId, card_id: cardId });
        if (error) throw error;
      }
    },
    onMutate: async ({ cardId, currentlyWished, dexNum }) => {
      await qc.cancelQueries({ queryKey: ['user_wishlist', userId, dexNum] });
      await qc.cancelQueries({ queryKey: ['user_wishlist_all', userId] });
      const prev = qc.getQueryData<Set<string>>(['user_wishlist', userId, dexNum]);
      const next = new Set(prev ?? []);
      if (currentlyWished) next.delete(cardId); else next.add(cardId);
      qc.setQueryData(['user_wishlist', userId, dexNum], next);
      return { prev };
    },
    onError: (_e, { dexNum }, ctx) => {
      if (ctx?.prev) qc.setQueryData(['user_wishlist', userId, dexNum], ctx.prev);
      toast('Impossible de sauvegarder la wishlist, réessaie.');
    },
    onSettled: (_r, _e, { dexNum }) => {
      qc.invalidateQueries({ queryKey: ['user_wishlist', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['user_wishlist_all', userId] });
      qc.invalidateQueries({ queryKey: ['wished_dex_nums', userId] });
    },
  });
}

export function useWishedDexNums(userId?: string) {
  return useQuery({
    queryKey: ['wished_dex_nums', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wishlist')
        .select('tcg_cards!inner(dex_num)')
        .eq('user_id', userId!);
      if (error) throw error;
      const set = new Set<number>();
      for (const row of data ?? []) {
        const dn = (row.tcg_cards as any)?.dex_num;
        if (typeof dn === 'number') set.add(dn);
      }
      return set;
    },
  });
}
