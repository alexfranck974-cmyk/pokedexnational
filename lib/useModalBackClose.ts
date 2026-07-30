import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Stack of currently-open modals' close callbacks, in open order. A single
// module-level popstate listener pops only the top of this stack — without
// it, nested modals (e.g. AllBadgesModal → BadgeDetailModal, each running
// their own useModalBackClose) would BOTH react to the same back gesture,
// since a plain per-instance `window.addEventListener('popstate', …)` fires
// for every currently-mounted listener, not just the most recent one. That
// made one back-press close the whole stack instead of stepping back one
// level at a time.
//
// Exactly one history entry is kept pending whenever the stack is non-empty
// ("re-armed" after each pop that leaves modals still open), so however deep
// the nesting, one back-press always closes just the top modal and reveals
// whatever was open underneath it.
const modalStack: Array<() => void> = [];
let hasPendingEntry = false;
let listenerAttached = false;

function ensureGlobalListener() {
  if (listenerAttached || Platform.OS !== 'web') return;
  listenerAttached = true;
  window.addEventListener('popstate', () => {
    const top = modalStack.pop();
    top?.();
    if (modalStack.length > 0) {
      window.history.pushState({ modalOpen: true }, '');
    } else {
      hasPendingEntry = false;
    }
  });
}

// On web, make the browser/Android back gesture close the topmost open modal
// instead of navigating the underlying page away (or closing every open
// modal at once, when nested). Keyed on isOpen so browsing between items
// within an open modal doesn't push/pop per item.
export function useModalBackClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;
    ensureGlobalListener();

    let closedViaPopState = false;
    const handler = () => { closedViaPopState = true; onCloseRef.current(); };
    modalStack.push(handler);
    if (!hasPendingEntry) {
      window.history.pushState({ modalOpen: true }, '');
      hasPendingEntry = true;
    }

    return () => {
      if (closedViaPopState) return;
      const idx = modalStack.lastIndexOf(handler);
      if (idx !== -1) modalStack.splice(idx, 1);
      // Only consume the pending history entry if nothing is left open under
      // us — if a parent modal is still open, the entry still belongs to it.
      if (modalStack.length === 0 && hasPendingEntry) {
        hasPendingEntry = false;
        window.history.back();
      }
    };
  }, [isOpen]);
}
