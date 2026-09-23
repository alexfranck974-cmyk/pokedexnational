import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

const VERSION_STORAGE_KEY = 'reference_data_version';

// Query keys backing the app's TCG reference-data indexes — all cached with
// staleTime: Infinity (lib/tcg.ts, lib/tcg-index.ts, lib/sealed-products.ts)
// since they only ever change when a sync script runs, never from anything
// the user does. That's the right call most of the time, but combined with
// the persisted query cache (lib/query-persist.ts, restored on every boot),
// it also means a freshly-synced set never surfaces for an already-installed
// client — restoring stale data into an Infinity-staleTime query means React
// Query treats it as still fully fresh forever, with no automatic refetch.
// Confirmed live 2026-09-23: after syncing 30th Celebration's 191 cards, an
// already-open session's Extensions list still only showed the pre-sync set
// list. Parameterized keys (tcg_cards_by_dex, _by_artist, _by_set) are listed
// by their base tuple only — invalidateQueries matches by prefix by default,
// so this still catches every already-cached dex/artist/set variant.
const REFERENCE_DATA_KEYS: string[][] = [
  ['pokemon_tcg_index'], ['tcg_sets'], ['tcg_variant_cards'], ['tcg_artists'], ['tcg_rarities'],
  ['tcg_cards_by_dex'], ['tcg_trainer_cards'], ['tcg_character_rare_cards'], ['tcg_tag_team_cards'],
  ['tcg_cards_by_artist'], ['tcg_cards_by_set'], ['sealed_product_prices'],
];

async function getStoredVersion(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(VERSION_STORAGE_KEY) : null;
  }
  return await SecureStore.getItemAsync(VERSION_STORAGE_KEY);
}

async function setStoredVersion(version: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VERSION_STORAGE_KEY, version);
    return;
  }
  await SecureStore.setItemAsync(VERSION_STORAGE_KEY, version);
}

// set_releases' most recent announced_at is a natural "did any sync script
// discover a new set since this device was last opened" signal — a DB
// trigger (migration 048) inserts a row there the moment the first card of
// any new set_id lands, covering every sync script (sync-tcg-cards.ts,
// sync-tcgdex-cards.ts, sync-pikaqian-cards.ts, ...) with no per-script
// wiring needed. Public read, no auth dependency (same RLS posture as
// tcg_cards/tcg_sets), so this is safe to call before a session exists.
async function getServerVersion(): Promise<string | null> {
  const { data, error } = await supabase
    .from('set_releases')
    .select('announced_at')
    .order('announced_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.announced_at as string;
}

// Called once at app boot (see app/_layout.tsx). Compares the server's
// latest set-release timestamp against what this device last saw — on a
// mismatch (including the very first run), invalidates the reference-data
// queries so they refetch instead of silently serving the persisted,
// infinitely-"fresh" snapshot from before whatever just synced. A no-op
// (and no network beyond the one lightweight lookup) when nothing changed,
// preserving the whole point of staleTime: Infinity for the common case.
export async function checkReferenceDataVersion(queryClient: QueryClient): Promise<void> {
  const serverVersion = await getServerVersion();
  if (!serverVersion) return;
  const storedVersion = await getStoredVersion();
  if (storedVersion === serverVersion) return;
  for (const key of REFERENCE_DATA_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
  await setStoredVersion(serverVersion);
}
