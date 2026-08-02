import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';
import { postFriendNewsIfNotable } from './friend-news';

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

export function useCardAcquiredAt(userId: string | undefined, dexNum: number | undefined) {
  return useQuery({
    queryKey: ['card_acquired_at', userId, dexNum],
    enabled: !!userId && !!dexNum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('acquired_at')
        .eq('user_id', userId!)
        .eq('dex_num', dexNum!)
        .maybeSingle();
      if (error) throw error;
      return (data?.acquired_at as string | undefined) ?? null;
    },
  });
}

export function useToggleCard() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({
      cardId, currentlyOwned, rarity,
    }: { cardId: string; currentlyOwned: boolean; dexNum: number; imageSmall: string; rarity?: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyOwned) {
        // Unchecking on the Pokémon page is the one place "I don't own this card
        // anymore" is unambiguous — clear both the dex pick and the ownership ledger.
        const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
        const { error: ledgerError } = await supabase.from('user_owned_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (ledgerError) throw ledgerError;
      } else {
        // Upsert replaces any existing card for the same (user_id, dex_num) via trigger + PK.
        // acquired_at is set explicitly: ON CONFLICT DO UPDATE only touches columns in the
        // payload, so without this the swap would silently keep the original card's old date.
        const acquiredAt = new Date().toISOString();
        const { error } = await supabase
          .from('user_cards')
          .upsert({ user_id: userId, card_id: cardId, acquired_at: acquiredAt }, { onConflict: 'user_id,dex_num' });
        if (error) throw error;
        // Picking a card as the official dex card means you own it — mirror into the
        // ownership ledger. Swapping to a different card later does NOT remove the
        // previous one from here: you can still own it, you just changed your pick.
        const { error: ledgerError } = await supabase
          .from('user_owned_cards')
          .upsert({ user_id: userId, card_id: cardId, acquired_at: acquiredAt }, { onConflict: 'user_id,card_id' });
        if (ledgerError) throw ledgerError;
        // A card just marked owned no longer belongs on the wishlist — no-op if it wasn't there.
        const { error: wishError } = await supabase.from('user_wishlist').delete().eq('user_id', userId).eq('card_id', cardId);
        if (wishError) throw wishError;
        await postFriendNewsIfNotable(userId, cardId, rarity ?? null);
      }
    },
    onMutate: async ({ cardId, currentlyOwned, dexNum, imageSmall }) => {
      await qc.cancelQueries({ queryKey: ['user_cards', userId, dexNum] });
      await qc.cancelQueries({ queryKey: ['user_dex', userId] });
      await qc.cancelQueries({ queryKey: ['owned_card_images', userId] });
      await qc.cancelQueries({ queryKey: ['user_wishlist', userId, dexNum] });
      await qc.cancelQueries({ queryKey: ['user_wishlist_all', userId] });

      const prevCards = qc.getQueryData<Set<string>>(['user_cards', userId, dexNum]);
      const prevDex = qc.getQueryData<Set<number>>(['user_dex', userId]);
      const prevImages = qc.getQueryData<Map<number, string>>(['owned_card_images', userId]);
      const prevWish = qc.getQueryData<Set<string>>(['user_wishlist', userId, dexNum]);
      const prevWishAll = qc.getQueryData<{ id: string }[]>(['user_wishlist_all', userId]);

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

      if (!currentlyOwned) {
        if (prevWish?.has(cardId)) {
          const nextWish = new Set(prevWish);
          nextWish.delete(cardId);
          qc.setQueryData(['user_wishlist', userId, dexNum], nextWish);
        }
        if (prevWishAll) {
          qc.setQueryData(['user_wishlist_all', userId], prevWishAll.filter(c => c.id !== cardId));
        }
      }

      return { prevCards, prevDex, prevImages, prevWish, prevWishAll };
    },
    onError: (_e, { dexNum }, ctx) => {
      if (ctx?.prevCards) qc.setQueryData(['user_cards', userId, dexNum], ctx.prevCards);
      if (ctx?.prevDex) qc.setQueryData(['user_dex', userId], ctx.prevDex);
      if (ctx?.prevImages) qc.setQueryData(['owned_card_images', userId], ctx.prevImages);
      if (ctx?.prevWish) qc.setQueryData(['user_wishlist', userId, dexNum], ctx.prevWish);
      if (ctx?.prevWishAll) qc.setQueryData(['user_wishlist_all', userId], ctx.prevWishAll);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: (_r, _e, { dexNum }) => {
      qc.invalidateQueries({ queryKey: ['user_cards', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['user_dex', userId] });
      qc.invalidateQueries({ queryKey: ['owned_card_images', userId] });
      qc.invalidateQueries({ queryKey: ['all_owned_card_ids', userId] });
      qc.invalidateQueries({ queryKey: ['card_acquired_at', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['all_owned_cards_detailed', userId] });
      qc.invalidateQueries({ queryKey: ['user_wishlist', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['user_wishlist_all', userId] });
      qc.invalidateQueries({ queryKey: ['wished_dex_nums', userId] });
      qc.invalidateQueries({ queryKey: ['owned_dex_nums', userId] });
      qc.invalidateQueries({ queryKey: ['ledger_cards_for_dex', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['all_owned_cards_ledger_detailed', userId] });
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
        .select('card_id, wished_at, tcg_cards(id, name, dex_num, set_id, set_name, card_number, rarity, image_small, image_large, release_date, cardmarket_trend_eur)')
        .eq('user_id', userId!)
        .order('wished_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter(r => r.tcg_cards != null)
        .map(r => ({ ...(r.tcg_cards as any), wished_at: r.wished_at as string }));
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

// Which Pokémon have at least one owned card in the ledger (user_owned_cards),
// regardless of whether an official National Dex card has been chosen for them.
export function useOwnedDexNums(userId?: string) {
  return useQuery({
    queryKey: ['owned_dex_nums', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
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

// All ledger-owned card ids for one Pokémon (not just the official dex pick) —
// used to unlock every owned printing on the Pokémon detail page's card grid.
export function useLedgerCardsForDex(userId: string | undefined, dexNum: number | undefined) {
  return useQuery({
    queryKey: ['ledger_cards_for_dex', userId, dexNum],
    enabled: !!userId && !!dexNum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id, tcg_cards!inner(dex_num)')
        .eq('user_id', userId!)
        .eq('tcg_cards.dex_num', dexNum!);
      if (error) throw error;
      return new Set<string>((data ?? []).map(r => r.card_id as string));
    },
  });
}

// Sourced from the ownership ledger (user_owned_cards), not user_cards: this answers
// "do I own this exact card" regardless of whether it's the chosen National Dex card
// for its Pokémon. Used by set goals, custom lists, the public profile, and the wishlist.
export function useAllOwnedCardIds(userId?: string) {
  return useQuery({
    queryKey: ['all_owned_card_ids', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id')
        .eq('user_id', userId!);
      if (error) throw error;
      return new Set<string>((data ?? []).map(r => r.card_id as string));
    },
  });
}

export function useToggleOwnedCard() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ cardId, currentlyOwned, rarity }: { cardId: string; currentlyOwned: boolean; rarity?: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyOwned) {
        const { error } = await supabase.from('user_owned_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
        // A card no longer owned can't stay pointed to as anyone's official
        // National Dex pick — clear it there too if it was (no-op otherwise).
        const { error: officialError } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (officialError) throw officialError;
      } else {
        const { error } = await supabase.from('user_owned_cards').insert({ user_id: userId, card_id: cardId });
        if (error) throw error;
        await postFriendNewsIfNotable(userId, cardId, rarity ?? null);
      }
    },
    onMutate: async ({ cardId, currentlyOwned }) => {
      await qc.cancelQueries({ queryKey: ['all_owned_card_ids', userId] });
      const prev = qc.getQueryData<Set<string>>(['all_owned_card_ids', userId]);
      const next = new Set(prev ?? []);
      if (currentlyOwned) next.delete(cardId); else next.add(cardId);
      qc.setQueryData(['all_owned_card_ids', userId], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['all_owned_card_ids', userId], ctx.prev);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['all_owned_card_ids', userId] });
      qc.invalidateQueries({ queryKey: ['owned_dex_nums', userId] });
      qc.invalidateQueries({ queryKey: ['all_owned_cards_ledger_detailed', userId] });
      qc.invalidateQueries({ queryKey: ['user_dex', userId] });
      qc.invalidateQueries({ queryKey: ['owned_card_images', userId] });
      qc.invalidateQueries({ queryKey: ['all_owned_cards_detailed', userId] });
    },
  });
}

// How many copies of each card the user owns — a foundation for future trading
// (knowing which duplicates are spare). Separate from useAllOwnedCardIds (which
// only answers "owned or not") so screens that don't need counts stay cheap.
export function useOwnedCardQuantities(userId?: string) {
  return useQuery({
    queryKey: ['owned_card_quantities', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id, quantity')
        .eq('user_id', userId!);
      if (error) throw error;
      return new Map<string, number>((data ?? []).map(r => [r.card_id as string, r.quantity as number]));
    },
  });
}

export function useAdjustOwnedCardQuantity() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['all_owned_card_ids', userId] });
    qc.invalidateQueries({ queryKey: ['owned_card_quantities', userId] });
    qc.invalidateQueries({ queryKey: ['owned_dex_nums', userId] });
    qc.invalidateQueries({ queryKey: ['all_owned_cards_ledger_detailed', userId] });
    qc.invalidateQueries({ queryKey: ['user_dex', userId] });
    qc.invalidateQueries({ queryKey: ['owned_card_images', userId] });
    qc.invalidateQueries({ queryKey: ['all_owned_cards_detailed', userId] });
  };

  return useMutation({
    mutationFn: async ({ cardId, delta, currentQuantity, rarity }: { cardId: string; delta: 1 | -1; currentQuantity: number; rarity?: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const next = currentQuantity + delta;
      if (next <= 0) {
        const { error } = await supabase.from('user_owned_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
        // A card no longer owned can't stay pointed to as anyone's official
        // National Dex pick — clear it there too if it was (no-op otherwise).
        const { error: officialError } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (officialError) throw officialError;
      } else if (currentQuantity <= 0) {
        const { error } = await supabase.from('user_owned_cards').insert({ user_id: userId, card_id: cardId, quantity: next });
        if (error) throw error;
        await postFriendNewsIfNotable(userId, cardId, rarity ?? null);
      } else {
        const { error } = await supabase.from('user_owned_cards').update({ quantity: next }).eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
      }
    },
    onMutate: async ({ cardId, delta, currentQuantity }) => {
      await qc.cancelQueries({ queryKey: ['owned_card_quantities', userId] });
      await qc.cancelQueries({ queryKey: ['all_owned_card_ids', userId] });
      const prevQuantities = qc.getQueryData<Map<string, number>>(['owned_card_quantities', userId]);
      const prevIds = qc.getQueryData<Set<string>>(['all_owned_card_ids', userId]);
      const nextQty = currentQuantity + delta;
      const nextQuantities = new Map(prevQuantities ?? []);
      const nextIds = new Set(prevIds ?? []);
      if (nextQty <= 0) { nextQuantities.delete(cardId); nextIds.delete(cardId); }
      else { nextQuantities.set(cardId, nextQty); nextIds.add(cardId); }
      qc.setQueryData(['owned_card_quantities', userId], nextQuantities);
      qc.setQueryData(['all_owned_card_ids', userId], nextIds);
      return { prevQuantities, prevIds };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevQuantities) qc.setQueryData(['owned_card_quantities', userId], ctx.prevQuantities);
      if (ctx?.prevIds) qc.setQueryData(['all_owned_card_ids', userId], ctx.prevIds);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: invalidateAll,
  });
}

export function useAllOwnedCardsLedgerDetailed(userId?: string) {
  return useQuery({
    queryKey: ['all_owned_cards_ledger_detailed', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id, acquired_at, tcg_cards(dex_num, name, image_small, image_large, set_id, set_name, card_number, rarity, cardmarket_trend_eur, artist)')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []).map(r => {
        const card = r.tcg_cards as any;
        return {
          cardId: r.card_id as string,
          dexNum: (card?.dex_num as number | undefined) ?? 0,
          acquiredAt: r.acquired_at as string,
          rarity: (card?.rarity as string | undefined) ?? null,
          name: (card?.name as string | undefined) ?? '',
          imageSmall: (card?.image_small as string | undefined) ?? '',
          imageLarge: (card?.image_large as string | undefined) ?? null,
          setId: (card?.set_id as string | undefined) ?? '',
          setName: (card?.set_name as string | undefined) ?? '',
          cardNumber: (card?.card_number as string | undefined) ?? '',
          cardmarketTrendEur: (card?.cardmarket_trend_eur as number | undefined) ?? null,
          artist: (card?.artist as string | undefined) ?? null,
        };
      }) as (OwnedCardDetail & { setId: string; setName: string; cardNumber: string })[];
    },
  });
}

export interface OwnedCardDetail {
  cardId: string;
  dexNum: number;
  acquiredAt: string;
  rarity: string | null;
  name: string;
  imageSmall: string;
  imageLarge: string | null;
  cardmarketTrendEur: number | null;
  artist: string | null;
}

export function useAllOwnedCardsDetailed(userId?: string) {
  return useQuery({
    queryKey: ['all_owned_cards_detailed', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('card_id, dex_num, acquired_at, tcg_cards(rarity, name, image_small, image_large, cardmarket_trend_eur, artist)')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []).map(r => {
        const card = r.tcg_cards as any;
        return {
          cardId: r.card_id as string,
          dexNum: r.dex_num as number,
          acquiredAt: r.acquired_at as string,
          rarity: (card?.rarity as string | undefined) ?? null,
          name: (card?.name as string | undefined) ?? '',
          imageSmall: (card?.image_small as string | undefined) ?? '',
          imageLarge: (card?.image_large as string | undefined) ?? null,
          cardmarketTrendEur: (card?.cardmarket_trend_eur as number | undefined) ?? null,
          artist: (card?.artist as string | undefined) ?? null,
        };
      }) as OwnedCardDetail[];
    },
  });
}
