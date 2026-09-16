import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Device-local only, same load-once-async-then-flash-to-stored pattern as
// lib/pokedex-view-mode.ts — a display preference for one screen's strip,
// not worth a profiles column + Supabase round trip.
export type RecentAdditionsFilter = 'all' | 'chase' | 'basic';

const STORAGE_KEY = 'recent_additions_filter';
// Defaults to chase-only: commons/uncommons added while filling out a set
// would otherwise drown out the pulls actually worth showing off.
const DEFAULT_FILTER: RecentAdditionsFilter = 'chase';

function isFilter(v: string | null): v is RecentAdditionsFilter {
  return v === 'all' || v === 'chase' || v === 'basic';
}

async function getStored(): Promise<string | null> {
  if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function setStored(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

export function useRecentAdditionsFilter() {
  const [filter, setFilterState] = useState<RecentAdditionsFilter>(DEFAULT_FILTER);

  useEffect(() => {
    let alive = true;
    getStored().then(v => { if (alive && isFilter(v)) setFilterState(v); });
    return () => { alive = false; };
  }, []);

  const setFilter = (next: RecentAdditionsFilter) => {
    setFilterState(next);
    setStored(next);
  };

  return { filter, setFilter };
}
