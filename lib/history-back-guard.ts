import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Module-level (not React state) so it survives component mounts/unmounts
// within the same browser tab — see useHistoryBackGuard below for why that
// matters here.
let guardActive = false;

// pokemon/[num] and pinned-set/[setId] are hidden Tabs.Screen siblings (see
// app/(app)/_layout.tsx) — the tab navigator's web history integration
// collapses tab-to-tab navigation via replaceState, so the phone/browser
// back gesture normally jumps straight past these screens' real history to
// whichever collapsed entry sits underneath (Dashboard), bypassing React
// Navigation's action system entirely (confirmed live: a `beforeRemove`
// listener never fires for it).
//
// The fix: push one extra "guard" history entry on mount so that jump lands
// there first, firing a `popstate` we catch and correct via the screen's own
// `from`-aware target — same idea as the on-screen "Retour" button.
//
// Capped to AT MOST ONE outstanding guard at a time (module-level flag, not
// one push per screen mount): pushing a fresh guard every time a guarded
// screen was visited shrank how much *real* browser history remained before
// hitting the floor (about:blank, or exiting the app) — reproduced live,
// landing on a blank page after as few as 2-3 back presses from a shallow
// history (a fresh tab, a shared link). One shared guard, reused across
// however many guarded screens get chained through before the user actually
// backs out, keeps the worst case at exactly one extra entry, not N.
export function useHistoryBackGuard(onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    if (!guardActive) {
      guardActive = true;
      window.history.pushState({ __backGuard: true }, '', window.location.href);
    }

    const onPopState = () => {
      guardActive = false;
      onBackRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
