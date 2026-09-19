import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Device-local display-density preference — "some users want maximum info,
// others a minimal display" (raised 2026-09-19). Same storage trade-off as
// lib/motion.tsx's animationsEnabled: a per-device cosmetic setting, not
// account data, so no Supabase sync / no cross-device consistency guarantee.
export type HudDensity = 'minimal' | 'standard' | 'detailed';
export const HUD_DENSITY_ORDER: HudDensity[] = ['minimal', 'standard', 'detailed'];

const HUD_DENSITY_STORAGE_KEY = 'hud_density';

function isHudDensity(v: string | null): v is HudDensity {
  return v === 'minimal' || v === 'standard' || v === 'detailed';
}

async function getStoredDensity(): Promise<HudDensity | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(HUD_DENSITY_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(HUD_DENSITY_STORAGE_KEY);
  return isHudDensity(raw) ? raw : null;
}

async function setStoredDensity(density: HudDensity): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HUD_DENSITY_STORAGE_KEY, density);
    return;
  }
  await SecureStore.setItemAsync(HUD_DENSITY_STORAGE_KEY, density);
}

interface HudDensityContextValue {
  density: HudDensity;
  setDensity: (density: HudDensity) => void;
  /** Advances minimal -> standard -> detailed -> minimal — the on-screen
   * toggle button in each screen's toolbar cycles through this directly,
   * same UX as usePokedexViewMode's cyclePageLayout. */
  cycleDensity: () => void;
}

const HudDensityContext = createContext<HudDensityContextValue | null>(null);

export function HudDensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<HudDensity>('standard');

  // Same "flash on load if the persisted value differs from the default"
  // trade-off as ThemeProvider/MotionProvider — acceptable rather than
  // blocking the whole app on storage.
  useEffect(() => {
    let alive = true;
    getStoredDensity().then(stored => { if (alive && stored !== null) setDensityState(stored); });
    return () => { alive = false; };
  }, []);

  const setDensity = (next: HudDensity) => {
    setDensityState(next);
    setStoredDensity(next);
  };

  const cycleDensity = () => {
    setDensityState(prev => {
      const next = HUD_DENSITY_ORDER[(HUD_DENSITY_ORDER.indexOf(prev) + 1) % HUD_DENSITY_ORDER.length];
      setStoredDensity(next);
      return next;
    });
  };

  const value = useMemo<HudDensityContextValue>(() => ({ density, setDensity, cycleDensity }), [density]);
  return <HudDensityContext.Provider value={value}>{children}</HudDensityContext.Provider>;
}

export function useHudDensity(): HudDensityContextValue {
  const ctx = useContext(HudDensityContext);
  if (!ctx) throw new Error('useHudDensity must be used within HudDensityProvider');
  return ctx;
}

export const HUD_DENSITY_ICON: Record<HudDensity, 'eye-off-outline' | 'eye-outline' | 'eye'> = {
  minimal: 'eye-off-outline',
  standard: 'eye-outline',
  detailed: 'eye',
};
