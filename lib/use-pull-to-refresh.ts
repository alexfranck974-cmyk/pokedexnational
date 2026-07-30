import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Generic "tirer pour rafraîchir" — invalidates every active query rather than
// an enumerated per-screen list, since most screens here mount 5-10+ hooks and
// a hand-maintained key list would silently go stale as hooks are added.
// Realtime already covers the Social tab's own signals (lib/realtime.ts) —
// this is the manual fallback for everything else (and a belt-and-suspenders
// refresh for Social too).
export function usePullToRefresh() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  return { refreshing, onRefresh };
}
