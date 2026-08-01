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
function appendParams(href: string, params: Record<string, string>): string {
  let result = href;
  for (const [key, value] of Object.entries(params)) {
    const sep = result.includes('?') ? '&' : '?';
    result += `${sep}${key}=${encodeURIComponent(value)}`;
  }
  return result;
}

// `extraParams`, when given, is appended to whichever target we resolve to
// (the decoded `from`, or the fallback) — e.g. so a detail screen can flag
// "something notable just happened" for the screen it's returning to, without
// that screen needing its own bespoke navigation channel.
export function useBackTo(fallback: string, extraParams?: Record<string, string>) {
  const router = useRouterHook();
  const { from } = useLocalSearchParams<{ from?: string }>();
  return () => {
    const target = from ? decodeURIComponent(from) : fallback;
    const finalTarget = extraParams ? appendParams(target, extraParams) : target;
    router.replace(finalTarget as Parameters<Router['replace']>[0]);
  };
}
