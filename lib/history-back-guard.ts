import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { isAnyModalOpen } from './useModalBackClose';

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

// CardZoomModal (lib/useModalBackClose.ts) also pushes its own dummy history
// entry while a card is zoomed, and calls history.back() itself to consume
// it when the zoom is dismissed by tapping (not the back button). That fires
// this hook's own popstate listener too — originally indistinguishable from
// a real "user pressed back", which silently kicked the user off the
// guarded screen every single time they closed a zoomed card (2026-09-05).
// Tried keying off `event.state` first (checking for a `__backGuard` marker
// on the landed-on entry) but Expo Router rewrites/replaces history state
// out from under both hooks — confirmed live, the state actually observed
// on landing was Expo Router's own `{id: "..."}` shape, never our marker.
// Direct module-level coordination between the two hooks instead: whoever
// is about to call history.back() to consume its own entry marks the next
// popstate as "expected" first, so this listener can tell "I caused this"
// apart from "the user really pressed back" without depending on state
// shape at all.
let suppressNextPop = false;
let suppressResetTimer: ReturnType<typeof setTimeout> | null = null;

// Call right before a history.back() that's just cleaning up your own
// pushState entry (not a real navigation) — see useModalBackClose.ts.
// Self-clears after a short delay as a safety net in case the expected
// popstate never arrives (e.g. no guard is mounted to consume it), so a
// stale flag can never suppress some later, unrelated, genuine back-press.
export function suppressNextBackGuardPop() {
  suppressNextPop = true;
  if (suppressResetTimer) clearTimeout(suppressResetTimer);
  suppressResetTimer = setTimeout(() => { suppressNextPop = false; }, 2000);
}

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
      if (suppressNextPop) {
        suppressNextPop = false;
        if (suppressResetTimer) { clearTimeout(suppressResetTimer); suppressResetTimer = null; }
        return;
      }
      // A real back-press while a card zoom (or any useModalBackClose modal)
      // is still open on this screen should just close that modal — this
      // listener runs first (mounted before any modal ever opens), so
      // without this check it would navigate the screen away before the
      // modal's own listener got a chance to react at all.
      if (isAnyModalOpen()) return;
      guardActive = false;
      onBackRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
