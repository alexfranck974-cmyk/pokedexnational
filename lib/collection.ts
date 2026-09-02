import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';
import { postFriendNewsIfNotable } from './friend-news';
import type { Locale } from './locale';

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

// Free-text personal note on the owned card slot (064_user_cards_note.sql) —
// e.g. "cadeau de ...". Deliberately never selected with `*` anywhere else in
// this file, so it can't leak onto the public profile view by accident (that
// page doesn't query user_cards directly, but user_cards' own SELECT policy
// does allow public read when is_public=true — omission here, not RLS, is
// what keeps a note private).
export function useCardNote(userId: string | undefined, dexNum: number | undefined) {
  return useQuery({
    queryKey: ['card_note', userId, dexNum],
    enabled: !!userId && !!dexNum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('note')
        .eq('user_id', userId!)
        .eq('dex_num', dexNum!)
        .maybeSingle();
      if (error) throw error;
      return (data?.note as string | null | undefined) ?? null;
    },
  });
}

export function useUpdateCardNote() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ dexNum, note }: { dexNum: number; note: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('user_cards').update({ note }).eq('user_id', userId).eq('dex_num', dexNum);
      if (error) throw error;
    },
    onMutate: async ({ dexNum, note }) => {
      await qc.cancelQueries({ queryKey: ['card_note', userId, dexNum] });
      const prev = qc.getQueryData<string | null>(['card_note', userId, dexNum]);
      qc.setQueryData(['card_note', userId, dexNum], note);
      return { prev };
    },
    onError: (_e, { dexNum }, ctx) => {
      if (ctx && 'prev' in ctx) qc.setQueryData(['card_note', userId, dexNum], ctx.prev);
      toast('Impossible de sauvegarder la note, réessaie.');
    },
    onSettled: (_r, _e, { dexNum }) => qc.invalidateQueries({ queryKey: ['card_note', userId, dexNum] }),
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
        // anymore" is unambiguous — clear both the dex pick and every finish of
        // this card in the ownership ledger.
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
        // ownership ledger, as a normal-finish copy (the default bucket the fast tap
        // manages; other finishes are tracked via the per-card details sheet).
        // Swapping to a different card later does NOT remove the previous one from
        // here: you can still own it, you just changed your pick.
        const { error: ledgerError } = await supabase
          .from('user_owned_cards')
          .upsert({ user_id: userId, card_id: cardId, finish: 'normal', acquired_at: acquiredAt }, { onConflict: 'user_id,card_id,finish' });
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
      qc.invalidateQueries({ queryKey: ['owned_card_finishes', userId] });
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
        .select('card_id, wished_at, is_priority, price_alert_eur, tcg_cards(id, name, dex_num, set_id, set_name, card_number, rarity, image_small, image_large, release_date, cardmarket_trend_eur, cardmarket_low_eur)')
        .eq('user_id', userId!)
        .order('wished_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter(r => r.tcg_cards != null)
        .map(r => ({
          ...(r.tcg_cards as any),
          wished_at: r.wished_at as string,
          is_priority: r.is_priority as boolean,
          price_alert_eur: r.price_alert_eur as number | null,
        }));
    },
  });
}

export function useToggleWishPriority() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ cardId, currentlyPriority }: { cardId: string; currentlyPriority: boolean }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('user_wishlist')
        .update({ is_priority: !currentlyPriority })
        .eq('user_id', userId)
        .eq('card_id', cardId);
      if (error) throw error;
    },
    onMutate: async ({ cardId, currentlyPriority }) => {
      await qc.cancelQueries({ queryKey: ['user_wishlist_all', userId] });
      const prev = qc.getQueryData<any[]>(['user_wishlist_all', userId]);
      if (prev) {
        qc.setQueryData(['user_wishlist_all', userId], prev.map(c => c.id === cardId ? { ...c, is_priority: !currentlyPriority } : c));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['user_wishlist_all', userId], ctx.prev);
      toast('Impossible de mettre à jour, réessaie.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['user_wishlist_all', userId] }),
  });
}

export function useSetWishPriceAlert() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    // priceAlertEur: null clears the alert.
    mutationFn: async ({ cardId, priceAlertEur }: { cardId: string; priceAlertEur: number | null }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('user_wishlist')
        .update({ price_alert_eur: priceAlertEur })
        .eq('user_id', userId)
        .eq('card_id', cardId);
      if (error) throw error;
    },
    onMutate: async ({ cardId, priceAlertEur }) => {
      await qc.cancelQueries({ queryKey: ['user_wishlist_all', userId] });
      const prev = qc.getQueryData<any[]>(['user_wishlist_all', userId]);
      if (prev) {
        qc.setQueryData(['user_wishlist_all', userId], prev.map(c => c.id === cardId ? { ...c, price_alert_eur: priceAlertEur } : c));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['user_wishlist_all', userId], ctx.prev);
      toast('Impossible de mettre à jour l’alerte, réessaie.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['user_wishlist_all', userId] }),
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
        // "I don't own this card anymore" clears every finish, not just normal —
        // fine-grained per-finish removal happens through the details sheet instead.
        const { error } = await supabase.from('user_owned_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
        // A card no longer owned can't stay pointed to as anyone's official
        // National Dex pick — clear it there too if it was (no-op otherwise).
        const { error: officialError } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (officialError) throw officialError;
      } else {
        const { error } = await supabase.from('user_owned_cards').insert({ user_id: userId, card_id: cardId, finish: 'normal' });
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
      qc.invalidateQueries({ queryKey: ['owned_card_finishes', userId] });
    },
  });
}

// How many normal-finish copies of each card the user owns — a foundation for
// future trading (knowing which duplicates are spare). Separate from
// useAllOwnedCardIds (which only answers "owned or not", finish-agnostic) so
// screens that don't need counts stay cheap. Scoped to finish='normal' because
// that's the only bucket the fast +/- pill (and trades) ever touch — other
// finishes are tracked via useOwnedCardFinishRows / the card details sheet.
export function useOwnedCardQuantities(userId?: string) {
  return useQuery({
    queryKey: ['owned_card_quantities', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id, quantity')
        .eq('user_id', userId!)
        .eq('finish', 'normal');
      if (error) throw error;
      return new Map<string, number>((data ?? []).map(r => [r.card_id as string, r.quantity as number]));
    },
  });
}

// finish defaults to 'normal' (the fast pill's bucket). The details sheet
// reuses this same mutation with finish set to 'holo'/'reverse_holo'.
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
    qc.invalidateQueries({ queryKey: ['owned_card_finish_rows', userId] });
    qc.invalidateQueries({ queryKey: ['owned_card_finishes', userId] });
  };

  return useMutation({
    mutationFn: async ({ cardId, delta, currentQuantity, rarity, finish = 'normal' }: { cardId: string; delta: 1 | -1; currentQuantity: number; rarity?: string | null; finish?: string }) => {
      if (!userId) throw new Error('Not signed in');
      const next = currentQuantity + delta;
      if (next <= 0) {
        const { error } = await supabase.from('user_owned_cards').delete().eq('user_id', userId).eq('card_id', cardId).eq('finish', finish);
        if (error) throw error;
        // Only un-pick the official National Dex card if no finish of it is
        // owned anymore — a user who still has e.g. a holo copy left should
        // keep their dex pick even after emptying out the normal-finish stack.
        const { data: remaining, error: remErr } = await supabase
          .from('user_owned_cards').select('finish').eq('user_id', userId).eq('card_id', cardId).limit(1);
        if (remErr) throw remErr;
        if (!remaining || remaining.length === 0) {
          const { error: officialError } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
          if (officialError) throw officialError;
        }
      } else if (currentQuantity <= 0) {
        const { error } = await supabase.from('user_owned_cards').insert({ user_id: userId, card_id: cardId, finish, quantity: next });
        if (error) throw error;
        await postFriendNewsIfNotable(userId, cardId, rarity ?? null);
      } else {
        const { error } = await supabase.from('user_owned_cards').update({ quantity: next }).eq('user_id', userId).eq('card_id', cardId).eq('finish', finish);
        if (error) throw error;
      }
    },
    onMutate: async ({ cardId, delta, currentQuantity, finish = 'normal' }) => {
      await qc.cancelQueries({ queryKey: ['owned_card_quantities', userId] });
      await qc.cancelQueries({ queryKey: ['all_owned_card_ids', userId] });
      const prevQuantities = qc.getQueryData<Map<string, number>>(['owned_card_quantities', userId]);
      const prevIds = qc.getQueryData<Set<string>>(['all_owned_card_ids', userId]);
      const nextQty = currentQuantity + delta;
      const nextQuantities = new Map(prevQuantities ?? []);
      const nextIds = new Set(prevIds ?? []);
      // Both caches are scoped/reasoned about in terms of the normal finish —
      // adjusting another finish still settles correctly via onSettled's
      // invalidation, just without an optimistic flash (acceptable: this path
      // is the detail sheet, not the fast primary tap).
      if (finish === 'normal') {
        if (nextQty <= 0) { nextQuantities.delete(cardId); nextIds.delete(cardId); }
        else { nextQuantities.set(cardId, nextQty); nextIds.add(cardId); }
      }
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
        .select('card_id, finish, condition, acquired_at, tcg_cards(dex_num, name, image_small, image_large, set_id, set_name, card_number, rarity, cardmarket_trend_eur, artist)')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []).map(r => {
        const card = r.tcg_cards as any;
        return {
          cardId: r.card_id as string,
          finish: r.finish as OwnedCardFinish,
          condition: (r.condition as OwnedCardCondition | null) ?? null,
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

// A physical copy's finish (print treatment) — kept distinct from the
// "variant" terminology used elsewhere for alternate Pokémon forms
// (mega/alolan/galarian/...), see lib/dashboard-stats.ts.
export type OwnedCardFinish = 'normal' | 'holo' | 'reverse_holo';
export type OwnedCardCondition = 'mint' | 'near_mint' | 'excellent' | 'good' | 'played' | 'poor';

const FINISH_LABELS: Record<OwnedCardFinish, string> = {
  normal: 'Normale',
  holo: 'Holo',
  reverse_holo: 'Reverse Holo',
};

const FINISH_LABELS_EN: Record<OwnedCardFinish, string> = {
  normal: 'Normal',
  holo: 'Holo',
  reverse_holo: 'Reverse Holo',
};

export function getFinishLabel(finish: OwnedCardFinish, locale: Locale): string {
  return locale === 'en' ? FINISH_LABELS_EN[finish] : FINISH_LABELS[finish];
}

export const CONDITION_LABELS: Record<OwnedCardCondition, string> = {
  mint: 'Mint (M)',
  near_mint: 'Near Mint (NM)',
  excellent: 'Excellent (EX)',
  good: 'Good (GD)',
  played: 'Played (PL)',
  poor: 'Poor (PO)',
};

export interface OwnedCardDetail {
  cardId: string;
  finish?: OwnedCardFinish;
  condition?: OwnedCardCondition | null;
  dexNum: number;
  acquiredAt: string;
  rarity: string | null;
  name: string;
  imageSmall: string;
  imageLarge: string | null;
  cardmarketTrendEur: number | null;
  artist: string | null;
}

export interface OwnedCardFinishRow {
  finish: OwnedCardFinish;
  quantity: number;
  condition: OwnedCardCondition | null;
}

// Per-finish breakdown (quantity + condition) for one card — feeds the card
// details sheet. Targeted at a single card_id, so cheap to run on-demand.
export function useOwnedCardFinishRows(userId: string | undefined, cardId: string | undefined) {
  return useQuery({
    queryKey: ['owned_card_finish_rows', userId, cardId],
    enabled: !!userId && !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('finish, quantity, condition')
        .eq('user_id', userId!)
        .eq('card_id', cardId!);
      if (error) throw error;
      return (data ?? []) as OwnedCardFinishRow[];
    },
  });
}

// Every owned finish per card, for every card the user owns — feeds the shiny
// gradient border on CardTile/CardListRow across a whole gallery (Pokémon
// detail, a pinned set, an artist's catalog...) without one query per tile.
export function useOwnedCardFinishes(userId?: string) {
  return useQuery({
    queryKey: ['owned_card_finishes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_owned_cards')
        .select('card_id, finish')
        .eq('user_id', userId!);
      if (error) throw error;
      const map = new Map<string, OwnedCardFinish[]>();
      for (const row of data ?? []) {
        const cardId = row.card_id as string;
        const finish = row.finish as OwnedCardFinish;
        const list = map.get(cardId);
        if (list) list.push(finish); else map.set(cardId, [finish]);
      }
      return map;
    },
  });
}

export function useUpdateFinishCondition() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ cardId, finish, condition }: { cardId: string; finish: OwnedCardFinish; condition: OwnedCardCondition }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('user_owned_cards')
        .update({ condition })
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('finish', finish);
      if (error) throw error;
    },
    onError: () => toast('Impossible de sauvegarder, réessaie.'),
    onSettled: (_r, _e, { cardId }) => {
      qc.invalidateQueries({ queryKey: ['owned_card_finish_rows', userId, cardId] });
      qc.invalidateQueries({ queryKey: ['all_owned_cards_ledger_detailed', userId] });
    },
  });
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
