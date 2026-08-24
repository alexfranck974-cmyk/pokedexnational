import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';
import type { OwnedCardFinish } from './collection';

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
  finish: OwnedCardFinish | null;
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
        .select('card_id, finish, image_url, position, added_at, tcg_cards(dex_num, name, image_small, image_large, set_name, card_number, rarity)')
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
            finish: ((r.finish as OwnedCardFinish | null) ?? 'normal'),
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
          finish: null,
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
    mutationFn: async ({ name, layout }: { name: string; layout: BinderLayout }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('user_collections')
        .insert({ user_id: userId, name, layout })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
    onError: () => toast('Impossible de créer le binder, réessaie.'),
  });
}

// Same as useCreateBinder, then bulk-fills every position with a card from the
// chosen set — in the set's own printed order (card_number, numeric-aware —
// same convention as the full-set browse view, app/(app)/pinned-set/[setId].tsx)
// so secret rares (numbered past the base set) land after the base run instead
// of being interleaved by dex_num, which scattered high-numbered alt-art/secret
// prints next to their base-set counterpart instead of at the end. A prefilled
// position just holds a real card_id like any manually-assigned one, so the
// existing "not owned" badge in the editor grid (favorites.tsx) already
// renders it correctly, and tapping a prefilled slot opens the same picker
// used to replace any other filled slot. Safe to insert sequentially (create
// then bulk-insert) since this is a brand new collection with no existing
// rows to collide with on the (collection_id, position) unique index.
//
// includeReverse (default false): appends a second full pass after the normal
// run — one slot per card whose available_finishes includes 'reverse_holo'
// (047_tcg_cards_available_finishes.sql; NULL/unsynced cards are skipped,
// never guessed) — in the same card_number order, so a "master set" binder
// reads "full normal run, then full reverse run", matching how physical
// collectors organize these. See 052_binder_slot_finish.sql for the schema
// change (finish column + widened per-finish uniqueness) that makes it legal
// for the same card_id to occupy two slots in one binder.
export function useCreatePrefilledBinder() {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidate = useInvalidateBinders();
  return useMutation({
    mutationFn: async ({ name, layout, setId, includeReverse = false }: {
      name: string; layout: BinderLayout; setId: string; includeReverse?: boolean;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { data: unordered, error: cardsErr } = await supabase
        .from('tcg_cards')
        .select('id, card_number, available_finishes')
        .eq('set_id', setId);
      if (cardsErr) throw cardsErr;
      const cards = [...(unordered ?? [])].sort((a, b) =>
        a.card_number.localeCompare(b.card_number, undefined, { numeric: true }),
      );

      const { data, error } = await supabase
        .from('user_collections')
        .insert({ user_id: userId, name, layout })
        .select('id')
        .single();
      if (error) throw error;
      const collectionId = data.id as string;

      const rows: { collection_id: string; card_id: string; finish: OwnedCardFinish; position: number }[] = [];
      let position = 0;
      for (const c of cards) {
        rows.push({ collection_id: collectionId, card_id: c.id as string, finish: 'normal', position: position++ });
      }
      if (includeReverse) {
        for (const c of cards) {
          const finishes = (c.available_finishes as string[] | null) ?? [];
          if (!finishes.includes('reverse_holo')) continue;
          rows.push({ collection_id: collectionId, card_id: c.id as string, finish: 'reverse_holo', position: position++ });
        }
      }
      if (rows.length > 0) {
        const { error: itemsErr } = await supabase.from('user_collection_items').insert(rows);
        if (itemsErr) throw itemsErr;
      }
      return collectionId;
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

// Swaps two slot positions (or, if the target is empty, simply moves the
// dragged card there) via the swap_binder_slots RPC — see 050_swap_binder_slots.sql
// for why this can't be two plain client-side UPDATEs (unique index on
// (collection_id, position)). Optimistically reorders the cached binder_cards
// list so the drag-and-drop UI in favorites.tsx snaps immediately on release.
export function useSwapBinderSlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ binderId, positionA, positionB }: { binderId: string; positionA: number; positionB: number }) => {
      const { error } = await supabase.rpc('swap_binder_slots', {
        p_collection_id: binderId, p_position_a: positionA, p_position_b: positionB,
      });
      if (error) throw error;
    },
    onMutate: async ({ binderId, positionA, positionB }) => {
      const key = ['binder_cards', binderId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BinderSlotItem[]>(key);
      if (previous) {
        qc.setQueryData<BinderSlotItem[]>(key, previous.map((item) => {
          if (item.position === positionA) return { ...item, position: positionB };
          if (item.position === positionB) return { ...item, position: positionA };
          return item;
        }));
      }
      return { previous, binderId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['binder_cards', context.binderId], context.previous);
      toast('Impossible de déplacer cette carte, réessaie.');
    },
    onSettled: (_r, _e, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
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

// Frees up a position by shifting everything at/after it by +1 — creates no
// row itself, the freed position becomes a normal "+" tile. See
// 051_binder_slot_insert_delete.sql for why this needs an RPC (the same
// unique-index-collision problem swap_binder_slots (050) has, but for a bulk
// shift instead of a two-item swap).
// Optimistically shifts the cached binder_cards list the same way
// useSwapBinderSlots does — Organiser mode is built for rapid sequential
// taps (the armed tool stays active across taps), so without this every
// insert/delete would wait a full round-trip while its sibling swap
// operation on the same screen feels instant.
export function useInsertBinderSlot() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, position }: { binderId: string; position: number }) => {
      const { error } = await supabase.rpc('insert_binder_slot', { p_collection_id: binderId, p_position: position });
      if (error) throw error;
    },
    onMutate: async ({ binderId, position }) => {
      const key = ['binder_cards', binderId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BinderSlotItem[]>(key);
      if (previous) {
        qc.setQueryData<BinderSlotItem[]>(key, previous.map((item) =>
          item.position >= position ? { ...item, position: item.position + 1 } : item,
        ));
      }
      return { previous, binderId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['binder_cards', context.binderId], context.previous);
      toast('Impossible d’insérer un emplacement, réessaie.');
    },
    onSettled: (_r, _e, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
  });
}

// Deletes whatever is at a position (if anything) and shifts everything
// after it down by -1 — distinct from useRemoveBinderSlot, which only clears
// content and leaves the position gap in place.
export function useDeleteBinderSlot() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async ({ binderId, position }: { binderId: string; position: number }) => {
      const { error } = await supabase.rpc('delete_binder_slot', { p_collection_id: binderId, p_position: position });
      if (error) throw error;
    },
    onMutate: async ({ binderId, position }) => {
      const key = ['binder_cards', binderId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BinderSlotItem[]>(key);
      if (previous) {
        qc.setQueryData<BinderSlotItem[]>(key, previous
          .filter((item) => item.position !== position)
          .map((item) => item.position > position ? { ...item, position: item.position - 1 } : item),
        );
      }
      return { previous, binderId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['binder_cards', context.binderId], context.previous);
      toast('Impossible de supprimer cet emplacement, réessaie.');
    },
    onSettled: (_r, _e, { binderId }) => {
      qc.invalidateQueries({ queryKey: ['binders', userId] });
      qc.invalidateQueries({ queryKey: ['binder_cards', binderId] });
    },
  });
}
