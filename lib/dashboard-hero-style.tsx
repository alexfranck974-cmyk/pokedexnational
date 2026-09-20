import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Device-local preference, same pattern as lib/motion.tsx. Every screen's
// hero band except Dashboard's already flattened to a plain colors.surface
// fill (lib/theme.tsx's heroGradient, 2026-09-20 visual-redesign pass) —
// Dashboard was deliberately left with its richer blurred-vitrine-backdrop
// hero, since a little visual flair felt right on the "home" screen. This
// lets a user who prefers total consistency opt Dashboard into the same
// flat treatment as everywhere else instead of that being a fixed choice.
const FLAT_DASHBOARD_HERO_STORAGE_KEY = 'flat_dashboard_hero';

async function getStoredFlat(): Promise<boolean | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(FLAT_DASHBOARD_HERO_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(FLAT_DASHBOARD_HERO_STORAGE_KEY);
  return raw === 'true' ? true : raw === 'false' ? false : null;
}

async function setStoredFlat(flat: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(FLAT_DASHBOARD_HERO_STORAGE_KEY, String(flat));
    return;
  }
  await SecureStore.setItemAsync(FLAT_DASHBOARD_HERO_STORAGE_KEY, String(flat));
}

interface DashboardHeroStyleContextValue {
  flatDashboardHero: boolean;
  setFlatDashboardHero: (flat: boolean) => void;
}

const DashboardHeroStyleContext = createContext<DashboardHeroStyleContextValue | null>(null);

export function DashboardHeroStyleProvider({ children }: { children: ReactNode }) {
  const [flatDashboardHero, setFlatState] = useState(false);

  useEffect(() => {
    let alive = true;
    getStoredFlat().then(stored => { if (alive && stored !== null) setFlatState(stored); });
    return () => { alive = false; };
  }, []);

  const setFlatDashboardHero = (flat: boolean) => {
    setFlatState(flat);
    setStoredFlat(flat);
  };

  const value = useMemo<DashboardHeroStyleContextValue>(
    () => ({ flatDashboardHero, setFlatDashboardHero }),
    [flatDashboardHero],
  );
  return <DashboardHeroStyleContext.Provider value={value}>{children}</DashboardHeroStyleContext.Provider>;
}

export function useDashboardHeroStyle(): DashboardHeroStyleContextValue {
  const ctx = useContext(DashboardHeroStyleContext);
  if (!ctx) throw new Error('useDashboardHeroStyle must be used within DashboardHeroStyleProvider');
  return ctx;
}
