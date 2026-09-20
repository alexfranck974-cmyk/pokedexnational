// Minimal hand-rolled service worker — makes the web PWA's app shell itself
// bootable with zero network (previously: only the *data* survived offline,
// via lib/query-persist.ts on the JS side; a cold page load with nothing in
// the browser's HTTP cache still failed outright with no service worker at
// all, since there was nothing to serve the HTML/JS from).
//
// `expo export --platform web` (this app's build command, see vercel.json)
// produces one real JS bundle (a couple of content-hashed files under
// /_expo/static/) plus content-hashed images/fonts under /assets/, and a set
// of near-identical per-route .html files that Vercel's own rewrite rule
// ("/(.*)" -> "/index.html") makes irrelevant in practice — every URL serves
// the same SPA shell, which is what makes the two-bucket strategy below
// correct: cache-first for anything content-hashed (a new deploy can only
// ever produce NEW filenames for changed content, so caching those forever
// is safe — old, no-longer-referenced entries just sit unused, not stale),
// network-first for everything else (the shell itself, manifest.json,
// favicon, ...) so a normal online visit always gets whatever the current
// deploy actually is, falling back to whatever was last cached only when
// there's truly no network.
//
// Deliberately no cache-name versioning / eviction: since only content-
// hashed URLs are ever cache-first-served, an unbumped cache name can't
// cause stale content — at worst it accumulates now-unreferenced old-hash
// entries across many historical deploys, bounded by the browser's own
// Cache Storage quota/eviction, not a correctness issue. Simpler than
// wiring a build-time version string into a plain static file that (unlike
// the app's own JS) never passes through Metro's env-var substitution.
const CACHE_NAME = 'pokedexnational-shell-v1';
const HASHED_PREFIXES = ['/_expo/static/', '/assets/'];

function isHashedAsset(pathname) {
  return HASHED_PREFIXES.some((p) => pathname.startsWith(p));
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Supabase/CDN/etc. untouched

  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html'))),
  );
});
