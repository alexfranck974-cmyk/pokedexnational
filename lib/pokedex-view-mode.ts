import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Device-local only (no DB sync) — same load-once-async-then-flash-to-stored
// trade-off as lib/motion.tsx's animationsEnabled, but a plain hook instead
// of a Context: only app/(app)/pokedex.tsx consumes this, so a root-level
// Provider would be unwarranted plumbing.
export type PokedexViewMode = 'scroll' | 'page';
export type PokedexPageLayout = 9 | 12 | 16;

const VIEW_MODE_KEY = 'pokedex_view_mode';
const PAGE_LAYOUT_KEY = 'pokedex_page_layout';
const PAGE_LAYOUT_CYCLE: PokedexPageLayout[] = [9, 12, 16];

async function getStored(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

async function setStored(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export function usePokedexViewMode() {
  const [viewMode, setViewModeState] = useState<PokedexViewMode>('scroll');
  const [pageLayout, setPageLayoutState] = useState<PokedexPageLayout>(9);

  useEffect(() => {
    let alive = true;
    getStored(VIEW_MODE_KEY).then(v => { if (alive && (v === 'scroll' || v === 'page')) setViewModeState(v); });
    getStored(PAGE_LAYOUT_KEY).then(v => {
      const n = v ? parseInt(v, 10) : null;
      if (alive && (n === 9 || n === 12 || n === 16)) setPageLayoutState(n);
    });
    return () => { alive = false; };
  }, []);

  const toggleViewMode = () => {
    const next: PokedexViewMode = viewMode === 'scroll' ? 'page' : 'scroll';
    setViewModeState(next);
    setStored(VIEW_MODE_KEY, next);
  };

  const cyclePageLayout = () => {
    const idx = PAGE_LAYOUT_CYCLE.indexOf(pageLayout);
    const next = PAGE_LAYOUT_CYCLE[(idx + 1) % PAGE_LAYOUT_CYCLE.length];
    setPageLayoutState(next);
    setStored(PAGE_LAYOUT_KEY, String(next));
  };

  return { viewMode, toggleViewMode, pageLayout, cyclePageLayout };
}
