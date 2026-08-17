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
  itemCount: number;
}

export function useBinders(userId?: string) {
  return useQuery({
    queryKey: ['binders', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collections')
        .select('id, name, layout, user_collection_items(position)')
        .eq('user_id', userId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((c): Binder => ({
        id: c.id as string,
        name: c.name as string,
        layout: c.layout as BinderLayout,
        itemCount: ((c.user_collection_items ?? []) as any[]).length,
      }));
    },
  });
}

// A binder slot holds either a catalog card ('card') or a user-uploaded photo
// ('image') — see 043_binder_custom_images.sql. `imageUrl` is always the
// ready-to-render URL: the card's small art for 'card' slots, a short-lived
// signed Storage URL for 'image' slots. `imagePath` (Storage object path) is
// only set for 'image' slots — needed to delete the file on removal.
export interface BinderSlotItem {
  position: number;
  kind: 'card' | 'image';
  cardId: string | null;
  imagePath: string | null;
  imageUrl: string;
  dexNum: number | null;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  addedAt: string;
}

const SIGNED_URL_TTL_SECONDS = 3600;

export function useBinderCards(binderId?: string) {
  return useQuery({
    queryKey: ['binder_cards', binderId],
    enabled: !!binderId,
    staleTime: 50 * 60_000, // just under SIGNED_URL_TTL_SECONDS, so signed URLs don't go stale mid-render
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection_items')
        .select('card_id, image_url, position, added_at, tcg_cards(dex_num, name, image_small, image_large, set_name, card_number, rarity)')
        .eq('collection_id', binderId!)
        .order('position', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []).filter((r) => r.card_id != null ? r.tcg_cards != null : true);

      const imagePaths = rows.filter((r) => r.image_url).map((r) => r.image_url as string);
      const signedByPath = new Map<string, string>();
      if (imagePaths.length > 0) {
        const { data: signed, error: signErr } = await supabase.storage
          .from('binder-images')
          .createSignedUrls(imagePaths, SIGNED_URL_TTL_SECONDS);
        if (signErr) throw signErr;
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
        }
      }

      return rows.map((r): BinderSlotItem => {
        if (r.card_id) {
          const card = r.tcg_cards as any;
          return {
            position: r.position as number,
            kind: 'card',
            cardId: r.card_id as string,
            imagePath: null,
            imageUrl: card.image_small as string,
            dexNum: card.dex_num as number,
            name: card.name as string,
            setName: card.set_name as string,
            cardNumber: card.card_number as string,
            rarity: (card.rarity as string | undefined) ?? null,
            addedAt: r.added_at as string,
          };
        }
        const path = r.image_url as string;
        return {
          position: r.position as number,
          kind: 'image',
          cardId: null,
          imagePath: path,
          imageUrl: signedByPath.get(path) ?? '',
          dexNum: null,
          name: '',
          setName: null,
          cardNumber: null,
          rarity: null,
          addedAt: r.added_at as string,
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
// unique index, so tapping an already-filled slot replaces whatever was there
// (card or photo) instead of erroring on conflict. image_url is explicitly
// nulled so overwriting a photo slot with a card satisfies the exactly-one
// CHECK constraint (leftover photo file cleanup is best-effort, not done here).
export function useAssignCardToSlot() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, position, cardId }: { binderId: string; position: number; cardId: string }) => {
      const { error } = await supabase
        .from('user_collection_items')
        .upsert({ collection_id: binderId, card_id: cardId, image_url: null, position }, { onConflict: 'collection_id,position' });
      if (error) throw error;
    },
    onSuccess: (_r, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
    onError: () => toast('Impossible de placer cette carte ici, réessaie.'),
  });
}

// Uploads an already-cropped local image into the user's private folder of
// the binder-images bucket, then points the slot at it (see useAssignCardToSlot
// for why card_id is explicitly nulled on the upsert). previousImagePath, when
// given, is removed from Storage after the new upload succeeds.
export function useUploadBinderImage() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, position, uri, previousImagePath }: {
      binderId: string; position: number; uri: string; previousImagePath?: string | null;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const path = `${userId}/${binderId}/${position}-${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadErr } = await supabase.storage.from('binder-images').upload(path, blob, { contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;
      const { error: upsertErr } = await supabase
        .from('user_collection_items')
        .upsert({ collection_id: binderId, image_url: path, card_id: null, position }, { onConflict: 'collection_id,position' });
      if (upsertErr) throw upsertErr;
      if (previousImagePath) await supabase.storage.from('binder-images').remove([previousImagePath]);
    },
    onSuccess: (_r, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
    onError: () => toast('Impossible d’importer cette photo, réessaie.'),
  });
}

// Removes whatever occupies a slot (card or photo) by position — position is
// the universal address, unlike card_id which is null for photo slots. Cleans
// up the Storage object too when the slot held a photo.
export function useRemoveBinderSlot() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, position, imagePath }: { binderId: string; position: number; imagePath?: string | null }) => {
      const { error } = await supabase
        .from('user_collection_items')
        .delete()
        .eq('collection_id', binderId)
        .eq('position', position);
      if (error) throw error;
      if (imagePath) await supabase.storage.from('binder-images').remove([imagePath]);
    },
    onSuccess: (_r, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
    onError: () => toast('Impossible de retirer cette carte, réessaie.'),
  });
}
