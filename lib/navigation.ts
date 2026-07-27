import type { useRouter } from 'expo-router';
import { useLocalSearchParams, useRouter as useRouterHook } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

// Tab switches in this app collapse browser history via replaceState (see the
// comment in app/(app)/_layout.tsx), so router.back() can't be relied on to
// return to whichever tab a detail screen was entered from — it always bottoms
// out on the tab navigator's initial route (Pokédex). Passing the origin
// explicitly and reading it back on the detail screen sidesteps that entirely.
export function enterPokemonDetail(router: Router, href: string, from: string) {
  const sep = href.includes('?') ? '&' : '?';
  router.push(`${href}${sep}from=${encodeURIComponent(from)}` as Parameters<Router['push']>[0]);
}

export function withReturnTo(href: string, from: string): string {
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}from=${encodeURIComponent(from)}`;
}

// Used by a detail screen's back button: returns to the page it was entered
// from (via the `from` param above), or a fallback if reached directly
// (e.g. a deep link with no `from`, or browser back already at the boundary).
export function useBackTo(fallback: string) {
  const router = useRouterHook();
  const { from } = useLocalSearchParams<{ from?: string }>();
  return () => router.replace((from ? decodeURIComponent(from) : fallback) as Parameters<Router['replace']>[0]);
}
