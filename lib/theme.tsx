import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Fredoka carries headers and the hero number — Karla is body text — JetBrains Mono (tabular)
// renders every counted value (dex n°, %, card counts) like a Pokédex screen readout.
export const fonts = {
  display: 'Fredoka_700Bold',
  body: 'Karla_400Regular',
  bodyBold: 'Karla_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textDim: string;

  primary: string;
  primaryDark: string;
  /** Deepest stop of the hero gradient — stays dark in both themes so white hero text stays legible. */
  primaryBg: string;
  /** Soft tinted chip background (unlocked badge icons) — adapts direction per theme, unlike primaryBg. */
  primarySoft: string;

  success: string;
  successBg: string;

  danger: string;
  dangerBg: string;

  warning: string;

  overlay: string;
  backdrop: string;
}

export interface ShadowTokens {
  sm: object;
  md: object;
}

const darkColors: ColorTokens = {
  bg: '#14100f',
  surface: '#1f1917',
  surfaceAlt: '#2b221f',
  border: '#3a2d29',
  borderStrong: '#4d3a34',

  text: '#f6f0ec',
  textMuted: '#b8a89e',
  textDim: '#8a766c',

  primary: '#e0475a',
  primaryDark: '#b8283a',
  primaryBg: '#3d1219',
  primarySoft: '#3a2026',

  success: '#34d399',
  successBg: '#0b3d2e',

  danger: '#f2994a',
  dangerBg: '#4a2c12',

  warning: '#fbbf24',

  overlay: 'rgba(20, 16, 15, 0.85)',
  backdrop: 'rgba(0, 0, 0, 0.7)',
};

const lightColors: ColorTokens = {
  bg: '#faf5f1',
  surface: '#ffffff',
  surfaceAlt: '#f0e6df',
  border: '#e6d8cd',
  borderStrong: '#d8c4b5',

  text: '#211613',
  textMuted: '#6d5c53',
  textDim: '#93837a',

  primary: '#c81f34',
  primaryDark: '#8a1424',
  primaryBg: '#3d1219',
  primarySoft: '#fbe2e5',

  success: '#0f9d6e',
  successBg: '#dcf5ea',

  danger: '#c2660f',
  dangerBg: '#fbe9d6',

  warning: '#b8790a',

  overlay: 'rgba(20, 16, 15, 0.8)',
  backdrop: 'rgba(0, 0, 0, 0.5)',
};

const darkShadow: ShadowTokens = {
  sm: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2, elevation: 1,
  },
  md: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 2,
  },
};

const lightShadow: ShadowTokens = {
  sm: {
    shadowColor: '#3a2320', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  md: {
    shadowColor: '#3a2320', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2,
  },
};

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme_mode';

async function getStoredMode(): Promise<ThemeMode | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(THEME_STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : null;
}

async function setStoredMode(mode: ThemeMode): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, mode);
    return;
  }
  await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
}

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorTokens;
  shadow: ShadowTokens;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === 'light' ? 'light' : 'dark');

  // Apply a persisted override once storage resolves; a same-render flash if it differs
  // from the system default is an acceptable trade-off over blocking the whole app on it.
  useEffect(() => {
    let alive = true;
    getStoredMode().then(stored => { if (alive && stored) setModeState(stored); });
    return () => { alive = false; };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setStoredMode(next);
  };
  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    shadow: mode === 'dark' ? darkShadow : lightShadow,
    setMode,
    toggleMode,
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Builds a StyleSheet from the current theme, recomputed only when colors/shadow change. */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ColorTokens, shadow: ShadowTokens) => T,
): T {
  const { colors, shadow } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors, shadow)), [colors, shadow]);
}
