import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

export interface Collection {
  id: string;
  name: string;
  cardIds: string[];
}

export function useCollections(userId?: string) {
  return useQuery({
    queryKey: ['collections', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collections')
        .select('id, name, user_collection_items(card_id)')
        .eq('user_id', userId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(c => ({
        id: c.id as string,
        name: c.name as string,
        cardIds: ((c.user_collection_items ?? []) as any[]).map(i => i.card_id as string),
      })) as Collection[];
    },
  });
}

export interface CollectionCardDetail {
  cardId: string;
  dexNum: number;
  name: string;
  imageSmall: string;
  imageLarge: string | null;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  addedAt: string;
}

export function useCollectionCards(collectionId?: string) {
  return useQuery({
    queryKey: ['collection_cards', collectionId],
    enabled: !!collectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection_items')
        .select('card_id, added_at, tcg_cards(dex_num, name, image_small, image_large, set_name, card_number, rarity)')
        .eq('collection_id', collectionId!)
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter(r => r.tcg_cards != null)
        .map(r => {
          const card = r.tcg_cards as any;
          return {
            cardId: r.card_id as string,
            addedAt: r.added_at as string,
            dexNum: card.dex_num as number,
            name: card.name as string,
            imageSmall: card.image_small as string,
            imageLarge: (card.image_large as string | undefined) ?? null,
            setName: card.set_name as string,
            cardNumber: card.card_number as string,
            rarity: (card.rarity as string | undefined) ?? null,
          };
        }) as CollectionCardDetail[];
    },
  });
}

function useInvalidateCollections(collectionId?: string) {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return () => {
    qc.invalidateQueries({ queryKey: ['collections', userId] });
    if (collectionId) qc.invalidateQueries({ queryKey: ['collection_cards', collectionId] });
  };
}

export function useCreateCollection() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateCollections();

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
    onError: () => toast('Impossible de créer la collection, réessaie.'),
  });
}

export function useRenameCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: async ({ collectionId, name }: { collectionId: string; name: string }) => {
      const { error } = await supabase.from('user_collections').update({ name }).eq('id', collectionId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de renommer la collection, réessaie.'),
  });
}

export function useDeleteCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: async (collectionId: string) => {
      const { error } = await supabase.from('user_collections').delete().eq('id', collectionId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de supprimer la collection, réessaie.'),
  });
}

export function useAddCardToCollection() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ collectionId, cardId }: { collectionId: string; cardId: string }) => {
      const { error } = await supabase
        .from('user_collection_items')
        .upsert({ collection_id: collectionId, card_id: cardId }, { onConflict: 'collection_id,card_id' });
      if (error) throw error;
    },
    onSuccess: (_r, { collectionId }) => {
      qc.invalidateQueries({ queryKey: ['collections', userId] });
      qc.invalidateQueries({ queryKey: ['collection_cards', collectionId] });
    },
    onError: () => toast('Impossible d’ajouter cette carte, réessaie.'),
  });
}

export function useRemoveCardFromCollection() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ collectionId, cardId }: { collectionId: string; cardId: string }) => {
      const { error } = await supabase
        .from('user_collection_items')
        .delete()
        .eq('collection_id', collectionId)
        .eq('card_id', cardId);
      if (error) throw error;
    },
    onSuccess: (_r, { collectionId }) => {
      qc.invalidateQueries({ queryKey: ['collections', userId] });
      qc.invalidateQueries({ queryKey: ['collection_cards', collectionId] });
    },
    onError: () => toast('Impossible de retirer cette carte, réessaie.'),
  });
}
