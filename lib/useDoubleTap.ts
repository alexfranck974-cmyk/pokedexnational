import { useCallback, useEffect, useRef } from 'react';

const DOUBLE_TAP_DELAY = 280;

// A single tap fires onSingleTap immediately after the window closes; a
// second tap within the window cancels that and fires onDoubleTap instead.
// Used in place of onLongPress across the app's card grids, since long-press
// triggers the browser's native image context menu on real phones.
export function useDoubleTap(onSingleTap: () => void, onDoubleTap?: () => void) {
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);

  return useCallback(() => {
    if (!onDoubleTap) { onSingleTap(); return; }
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (pending.current) { clearTimeout(pending.current); pending.current = null; }
      lastTap.current = 0;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    pending.current = setTimeout(() => { onSingleTap(); pending.current = null; }, DOUBLE_TAP_DELAY);
  }, [onSingleTap, onDoubleTap]);
}
