import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';

// Read-only offline support: persist the React Query cache to disk so
// previously-loaded screens (Pokédex, collection, wishlist, ...) still show
// their last-known data with no network, instead of an empty/loading screen
// forever. Mutations are NOT queued for replay — attempting to write while
// offline still just fails and shows the existing "Impossible de
// sauvegarder" toasts already wired throughout lib/collection.ts, which is
// the deliberately-chosen scope (read-only, not full offline sync).
//
// The one real hazard here: this app's query hooks very commonly return
// `Set`/`Map` (owned dex numbers, card-id sets, dex_num->image maps, ...).
// Plain JSON.stringify turns a Set/Map into `{}`, silently losing it on
// persist — every consumer expecting `.has()`/`.get()` would then crash on
// the very first cold start after this shipped. Tag them going out, rebuild
// them coming in, so this works for every existing (and future) hook with
// no per-hook changes.
const SET_TAG = '__persisted_set__';
const MAP_TAG = '__persisted_map__';

function replacer(_key: string, value: unknown) {
  if (value instanceof Set) return { [SET_TAG]: Array.from(value) };
  if (value instanceof Map) return { [MAP_TAG]: Array.from(value.entries()) };
  return value;
}

function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object') {
    if (SET_TAG in (value as Record<string, unknown>)) return new Set((value as any)[SET_TAG]);
    if (MAP_TAG in (value as Record<string, unknown>)) return new Map((value as any)[MAP_TAG]);
  }
  return value;
}

const serialize = (data: unknown) => JSON.stringify(data, replacer);
const deserialize = (data: string) => JSON.parse(data, reviver);

// Offline data is "what you last saw", not a stand-in source of truth —
// anything older than this is dropped on restore instead of shown as if it
// were current. A real refetch still lands the moment the network is back
// (React Query's own normal staleTime/refetch behavior, unaffected by this).
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

export function createAppPersister(): Persister {
  if (Platform.OS === 'web') {
    return createSyncStoragePersister({
      storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
      serialize,
      deserialize,
      key: 'pokedexnational_query_cache',
    });
  }
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    serialize,
    deserialize,
    key: 'pokedexnational_query_cache',
  });
}

// React Query's default onlineManager listens to the browser's
// navigator.onLine + online/offline events, which don't exist on React
// Native — without this, queries on native never reliably learn the device
// went offline (they'd just hang/fail per-request instead of cleanly
// pausing). Web keeps the library default (already correct there), so this
// is a no-op on that platform. Call once at module scope, not per-render.
export function setupOnlineManager() {
  if (Platform.OS === 'web') return;
  onlineManager.setEventListener(setOnline =>
    NetInfo.addEventListener(state => setOnline(!!state.isConnected)),
  );
}
