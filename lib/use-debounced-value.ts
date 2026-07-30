import { useEffect, useState } from 'react';

// Unlike useDeferredValue (a soft scheduler hint), this guarantees at most one
// update per `delayMs` window — needed where the downstream consumer is a
// FlashList whose `data` length can swing drastically: FlashList v2's grid
// layout manager has a known crash when its internal layout bookkeeping is
// asked to process several large data-length changes in quick succession
// (upstream issue, reproduced against @shopify/flash-list up to 2.3.2).
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
