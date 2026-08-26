import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';
import { toast } from './toast';

// The "nebula" ring widgets on the Dashboard (app/(app)/dashboard.tsx) —
// reorderable and individually hideable via DashboardLayoutSheet.
export type RingKey = 'goals' | 'badges' | 'trades' | 'cards' | 'priceAlerts';
export const RING_KEYS: RingKey[] = ['goals', 'badges', 'trades', 'cards', 'priceAlerts'];

export interface DashboardRingLayout {
  order: RingKey[];
  hidden: Set<RingKey>;
}

function isRingKey(v: string): v is RingKey {
  return (RING_KEYS as string[]).includes(v);
}

// Always resolves to exactly RING_KEYS, just reordered — defends against a
// saved array that's stale (missing a ring key added after the user last
// customized) or corrupt, rather than trusting it as-is.
function normalizeOrder(saved: string[] | null): RingKey[] {
  const valid = (saved ?? []).filter(isRingKey) as RingKey[];
  const missing = RING_KEYS.filter(k => !valid.includes(k));
  return [...valid, ...missing];
}

export function useDashboardRingLayout(userId?: string) {
  return useQuery({
    queryKey: ['dashboard_ring_layout', userId],
    enabled: !!userId,
    queryFn: async (): Promise<DashboardRingLayout> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('dashboard_ring_order, dashboard_hidden_rings')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return {
        order: normalizeOrder(data.dashboard_ring_order as string[] | null),
        hidden: new Set((((data.dashboard_hidden_rings as string[] | null) ?? []).filter(isRingKey)) as RingKey[]),
      };
    },
  });
}

export function useUpdateDashboardRingLayout() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (layout: DashboardRingLayout) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profiles')
        .update({ dashboard_ring_order: layout.order, dashboard_hidden_rings: Array.from(layout.hidden) })
        .eq('id', userId);
      if (error) throw error;
    },
    onMutate: async (layout) => {
      await qc.cancelQueries({ queryKey: ['dashboard_ring_layout', userId] });
      const prev = qc.getQueryData<DashboardRingLayout>(['dashboard_ring_layout', userId]);
      qc.setQueryData(['dashboard_ring_layout', userId], layout);
      return { prev };
    },
    onError: (_err, _layout, ctx) => {
      if (ctx?.prev) qc.setQueryData(['dashboard_ring_layout', userId], ctx.prev);
      toast('Impossible d’enregistrer, réessaie.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['dashboard_ring_layout', userId] }),
  });
}
