import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export type BinderLayout = 1 | 4 | 9 | 12 | 16;

export const BINDER_LAYOUTS: BinderLayout[] = [1, 4, 9, 12, 16];

// Column count per layout — position/layout gives the page number, position%layout
// gives the index within that page, and this maps that index to a grid column.
export const BINDER_LAYOUT_COLS: Record<BinderLayout, number> = { 1: 1, 4: 2, 9: 3, 12: 4, 16: 4 };

export interface Binder {
  id: string;
  name: string;
  layout: BinderLayout;
  cardIds: string[];
}

export function useBinders(userId?: string) {
  return useQuery({
    queryKey: ['binders', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collections')
        .select('id, name, layout, user_collection_items(card_id, position)')
        .eq('user_id', userId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((c): Binder => ({
        id: c.id as string,
        name: c.name as string,
        layout: c.layout as BinderLayout,
        cardIds: ((c.user_collection_items ?? []) as any[])
          .sort((a, b) => a.position - b.position)
          .map((i) => i.card_id as string),
      }));
    },
  });
}

export interface BinderCardDetail {
  cardId: string;
  position: number;
  dexNum: number;
  name: string;
  imageSmall: string;
  imageLarge: string | null;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  addedAt: string;
}

export function useBinderCards(binderId?: string) {
  return useQuery({
    queryKey: ['binder_cards', binderId],
    enabled: !!binderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection_items')
        .select('card_id, position, added_at, tcg_cards(dex_num, name, image_small, image_large, set_name, card_number, rarity)')
        .eq('collection_id', binderId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.tcg_cards != null)
        .map((r): BinderCardDetail => {
          const card = r.tcg_cards as any;
          return {
            cardId: r.card_id as string,
            position: r.position as number,
            addedAt: r.added_at as string,
            dexNum: card.dex_num as number,
            name: card.name as string,
            imageSmall: card.image_small as string,
            imageLarge: (card.image_large as string | undefined) ?? null,
            setName: card.set_name as string,
            cardNumber: card.card_number as string,
            rarity: (card.rarity as string | undefined) ?? null,
          };
        });
    },
  });
}

function useInvalidateBinders(binderId?: string) {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return () => {
    qc.invalidateQueries({ queryKey: ['binders', userId] });
    if (binderId) qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
  };
}

export function useCreateBinder() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateBinders();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('user_collections')
        .insert({ user_id: userId, name })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de créer le binder, réessaie.'),
  });
}

export function useRenameBinder() {
  const invalidate = useInvalidateBinders();
  return useMutation({
    mutationFn: async ({ binderId, name }: { binderId: string; name: string }) => {
      const { error } = await supabase.from('user_collections').update({ name }).eq('id', binderId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de renommer le binder, réessaie.'),
  });
}

export function useDeleteBinder() {
  const invalidate = useInvalidateBinders();
  return useMutation({
    mutationFn: async (binderId: string) => {
      const { error } = await supabase.from('user_collections').delete().eq('id', binderId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de supprimer le binder, réessaie.'),
  });
}

export function useSetBinderLayout() {
  const invalidate = useInvalidateBinders();
  return useMutation({
    mutationFn: async ({ binderId, layout }: { binderId: string; layout: BinderLayout }) => {
      const { error } = await supabase.from('user_collections').update({ layout }).eq('id', binderId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de changer la mise en page, réessaie.'),
  });
}

// Places a card in a specific slot — upserts on the (collection_id, position)
// unique index, so tapping an already-filled slot replaces its card instead
// of erroring on the PK conflict. Fails harmlessly (toast) if the card is
// already placed elsewhere in this binder, since the PK is (collection_id, card_id) —
// the picker UI disables that case rather than expecting a silent move.
export function useAssignCardToSlot() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, position, cardId }: { binderId: string; position: number; cardId: string }) => {
      const { error } = await supabase
        .from('user_collection_items')
        .upsert({ collection_id: binderId, card_id: cardId, position }, { onConflict: 'collection_id,position' });
      if (error) throw error;
    },
    onSuccess: (_r, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
    onError: () => toast('Impossible de placer cette carte ici, réessaie.'),
  });
}

export function useRemoveCardFromBinder() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, cardId }: { binderId: string; cardId: string }) => {
      const { error } = await supabase
        .from('user_collection_items')
        .delete()
        .eq('collection_id', binderId)
        .eq('card_id', cardId);
      if (error) throw error;
    },
    onSuccess: (_r, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
    onError: () => toast('Impossible de retirer cette carte, réessaie.'),
  });
}
