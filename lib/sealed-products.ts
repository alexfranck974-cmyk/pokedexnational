import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';
import { postSealedProductNewsIfNotable } from './friend-news';
import type { StringKey } from './strings';

export type SealedProductType = 'display_box' | 'booster_box' | 'etb' | 'blister' | 'coffret' | 'booster' | 'autre';

// Order drives the stepper list in the "add sealed product" sheet.
export const SEALED_PRODUCT_TYPES: { type: SealedProductType; labelKey: StringKey }[] = [
  { type: 'display_box', labelKey: 'sealed.type.displayBox' },
  { type: 'booster_box', labelKey: 'sealed.type.boosterBox' },
  { type: 'etb', labelKey: 'sealed.type.etb' },
  { type: 'blister', labelKey: 'sealed.type.blister' },
  { type: 'coffret', labelKey: 'sealed.type.coffret' },
  { type: 'booster', labelKey: 'sealed.type.booster' },
  { type: 'autre', labelKey: 'sealed.type.autre' },
];

// setId -> productType -> quantity, for O(1) per-set lookup in the catalog list.
export type SealedProductsBySet = Map<string, Map<SealedProductType, number>>;

export function useSealedProducts(userId?: string) {
  return useQuery({
    queryKey: ['sealed_products', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sealed_products')
        .select('set_id, product_type, quantity')
        .eq('user_id', userId!);
      if (error) throw error;
      const bySet: SealedProductsBySet = new Map();
      for (const row of data ?? []) {
        const setId = row.set_id as string;
        const productType = row.product_type as SealedProductType;
        const quantity = row.quantity as number;
        if (!bySet.has(setId)) bySet.set(setId, new Map());
        bySet.get(setId)!.set(productType, quantity);
      }
      return bySet;
    },
  });
}

// Delta-based upsert/delete-at-zero, mirrors useAdjustOwnedCardQuantity
// (lib/collection.ts). On a genuine 0 -> N transition, posts a friend_news
// sealed_product event (every first-of-a-kind add is notable — no gate to
// apply here, unlike the chase-rarity gate on card pulls).
export function useAdjustSealedProduct() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ setId, setName, productType, delta, currentQuantity }: {
      setId: string; setName: string; productType: SealedProductType; delta: 1 | -1; currentQuantity: number;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const next = currentQuantity + delta;
      if (next <= 0) {
        const { error } = await supabase.from('user_sealed_products').delete().eq('user_id', userId).eq('set_id', setId).eq('product_type', productType);
        if (error) throw error;
      } else if (currentQuantity <= 0) {
        const { error } = await supabase.from('user_sealed_products').insert({ user_id: userId, set_id: setId, product_type: productType, quantity: next });
        if (error) throw error;
        await postSealedProductNewsIfNotable(userId, setId, setName, productType);
      } else {
        const { error } = await supabase.from('user_sealed_products').update({ quantity: next }).eq('user_id', userId).eq('set_id', setId).eq('product_type', productType);
        if (error) throw error;
      }
    },
    onMutate: async ({ setId, productType, delta, currentQuantity }) => {
      await qc.cancelQueries({ queryKey: ['sealed_products', userId] });
      const prev = qc.getQueryData<SealedProductsBySet>(['sealed_products', userId]);
      const next = new Map(prev ?? []);
      const nextForSet = new Map(next.get(setId) ?? []);
      const nextQty = currentQuantity + delta;
      if (nextQty <= 0) nextForSet.delete(productType); else nextForSet.set(productType, nextQty);
      next.set(setId, nextForSet);
      qc.setQueryData(['sealed_products', userId], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['sealed_products', userId], ctx.prev);
      toast('Impossible de sauvegarder, réessaie.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['sealed_products', userId] });
    },
  });
}
