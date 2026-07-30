import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const MOTION_STORAGE_KEY = 'animations_enabled';

async function getStoredEnabled(): Promise<boolean | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(MOTION_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(MOTION_STORAGE_KEY);
  return raw === 'true' ? true : raw === 'false' ? false : null;
}

async function setStoredEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOTION_STORAGE_KEY, String(enabled));
    return;
  }
  await SecureStore.setItemAsync(MOTION_STORAGE_KEY, String(enabled));
}

interface MotionContextValue {
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [animationsEnabled, setEnabledState] = useState(true);

  // Same "flash on load if the persisted value differs from the default" trade-off
  // as ThemeProvider — acceptable rather than blocking the whole app on storage.
  useEffect(() => {
    let alive = true;
    getStoredEnabled().then(stored => { if (alive && stored !== null) setEnabledState(stored); });
    return () => { alive = false; };
  }, []);

  const setAnimationsEnabled = (enabled: boolean) => {
    setEnabledState(enabled);
    setStoredEnabled(enabled);
  };

  const value = useMemo<MotionContextValue>(() => ({ animationsEnabled, setAnimationsEnabled }), [animationsEnabled]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion(): MotionContextValue {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotion must be used within MotionProvider');
  return ctx;
}
