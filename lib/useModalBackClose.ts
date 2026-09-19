import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { suppressNextBackGuardPop } from './history-back-guard';

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

// Read by history-back-guard.ts's own popstate listener, which mounts (and
// so registers) earlier than this module's — a screen guarded by
// useHistoryBackGuard mounts first, the user opens a modal on it after.
// Window popstate listeners fire in registration order, so on a real
// back-press while a modal is open, the guard's listener would otherwise
// run BEFORE this module's and immediately navigate the guarded screen
// away, never giving the modal a chance to just close first as intended.
export function isAnyModalOpen(): boolean {
  return modalStack.length > 0;
}

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
  const router = useRouter();
  // The screen we were actually on right before this modal pushed its dummy
  // entry — what "closing the modal" should visually return to.
  const openedFromPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;
    ensureGlobalListener();

    openedFromPathRef.current = window.location.pathname;
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
        const expectedPath = openedFromPathRef.current;
        // Deferred to a macrotask, not run synchronously here: a caller can
        // close this modal AND navigate elsewhere in the same action (e.g.
        // CardZoomModal's "voir l'extension" link — it closes the zoom, then
        // router.push()es to the set screen, right in the same handler).
        // Checking window.history.state synchronously in THIS cleanup can
        // still see our own {modalOpen:true} marker even though that
        // router.push already ran moments earlier in the same handler —
        // React's effect-cleanup timing isn't guaranteed to run after
        // Expo Router's own (possibly deferred) history write. Confirmed
        // live 2026-09-19: proceeding on that stale read called
        // history.back() after the set-screen's real pushState had already
        // landed, popping that real navigation instead of our own dummy
        // entry, and silently reverting back to the screen the zoom opened
        // from. setTimeout(0) runs after the current call stack (and any
        // synchronous pushState still in flight within it) has settled.
        setTimeout(() => {
          if (window.history.state?.modalOpen !== true) return;
          // See history-back-guard.ts's comment: this history.back() is
          // just consuming our own pushState entry, not a real navigation —
          // flag it so a mounted useHistoryBackGuard on this screen doesn't
          // treat it as the user pressing back and boot them off the screen.
          suppressNextBackGuardPop();
          window.history.back();
          // history.back() assumes the entry directly beneath our pushState
          // is still the screen we opened from — true when that screen was
          // reached via a real push, but PokedexSectionTabs switches tabs
          // with router.replace() (collapses in place, no new entry), so
          // opening this modal right after a tab switch can leave nothing
          // at that depth actually pointing at us. back() then overshoots
          // to whatever *previous* tab was active, landing the user there
          // instead of back on this screen (confirmed live 2026-09-19:
          // closing a wishlist sheet by tapping outside could land on
          // Pokédex/Collection). popstate from back() lands on a later
          // tick, so check after it — self-correct with a real in-app
          // navigation (router.replace, not a raw history call) so both
          // the URL and the rendered screen agree.
          if (expectedPath) {
            setTimeout(() => {
              if (window.location.pathname !== expectedPath) {
                router.replace(expectedPath as never);
              }
            }, 0);
          }
        }, 0);
      }
    };
  }, [isOpen, router]);
}
