import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  bubble: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Floating tab bar is `position: absolute` (app/(app)/_layout.tsx), so React Navigation
// no longer auto-reserves space for it — scrollable screen content needs this much bottom
// padding/margin to clear it (bar bottom offset + bar height + a small gap above it).
export const TAB_BAR_CLEARANCE = 100;

// Screen-level floating buttons (search/filter/columns FABs in SearchFilterBar,
// FavoritesFilterBar) anchor bottom-right like the global Settings FAB above the tab
// bar (app/(app)/_layout.tsx) — this clears both so the two stacks never overlap.
export const SCREEN_FAB_CLEARANCE = 142;

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

// A "palette" reskins the app's neutrals + accent (bg/surface/border/text/primary*) —
// each named after a Poké Ball. Success/danger/warning and shadows stay identical across
// palettes (semantic meaning shouldn't shift with the accent hue) and only vary by dark/light
// mode, same as before palettes existed.
export type PaletteId = 'pokeball' | 'greatball' | 'ultraball' | 'masterball' | 'healball';

export const PALETTE_ORDER: PaletteId[] = ['pokeball', 'greatball', 'ultraball', 'masterball', 'healball'];

type NeutralAccentTokens = Pick<ColorTokens,
  | 'bg' | 'surface' | 'surfaceAlt' | 'border' | 'borderStrong'
  | 'text' | 'textMuted' | 'textDim'
  | 'primary' | 'primaryDark' | 'primaryBg' | 'primarySoft'>;

interface PaletteDefinition {
  label: string;
  /** Representative dot color for the palette picker UI. */
  swatch: string;
  /** `overlay` is always a darkened tint of the palette's own dark bg, reused in both
   *  modes at different opacities — mirrors how `primaryBg` deliberately stays dark
   *  in both themes so it keeps working as a scrim. */
  overlayRgb: string;
  dark: NeutralAccentTokens;
  light: NeutralAccentTokens;
}

const PALETTES: Record<PaletteId, PaletteDefinition> = {
  pokeball: {
    label: 'Poké Ball',
    swatch: '#d33a4d',
    overlayRgb: '20, 16, 15',
    dark: {
      bg: '#14100f', surface: '#1f1917', surfaceAlt: '#2b221f', border: '#3a2d29', borderStrong: '#4d3a34',
      text: '#f6f0ec', textMuted: '#b8a89e', textDim: '#9a8579',
      primary: '#d33a4d', primaryDark: '#b8283a', primaryBg: '#3d1219', primarySoft: '#3a2026',
    },
    light: {
      bg: '#faf5f1', surface: '#ffffff', surfaceAlt: '#f0e6df', border: '#e6d8cd', borderStrong: '#d8c4b5',
      text: '#211613', textMuted: '#6d5c53', textDim: '#7d6c62',
      primary: '#c81f34', primaryDark: '#8a1424', primaryBg: '#3d1219', primarySoft: '#fbe2e5',
    },
  },
  greatball: {
    label: 'Great Ball',
    swatch: '#3b7dd8',
    overlayRgb: '13, 20, 32',
    dark: {
      bg: '#0d1420', surface: '#16202f', surfaceAlt: '#1f2d40', border: '#2b3c52', borderStrong: '#3a4f6c',
      text: '#eef3fa', textMuted: '#a9bad0', textDim: '#8fa0b8',
      primary: '#3b7dd8', primaryDark: '#2a5aa8', primaryBg: '#0f2038', primarySoft: '#1a2c42',
    },
    light: {
      bg: '#f2f6fb', surface: '#ffffff', surfaceAlt: '#e4edf7', border: '#d3e0ef', borderStrong: '#b9cce4',
      text: '#14202f', textMuted: '#4d5f75', textDim: '#64758a',
      primary: '#2a5aa8', primaryDark: '#1c3f7a', primaryBg: '#0f2038', primarySoft: '#e0ecfa',
    },
  },
  ultraball: {
    label: 'Ultra Ball',
    swatch: '#f0b429',
    overlayRgb: '12, 11, 10',
    dark: {
      bg: '#0c0b0a', surface: '#1a1714', surfaceAlt: '#241f1a', border: '#362f27', borderStrong: '#4a3f33',
      text: '#f7f1e6', textMuted: '#b8a98f', textDim: '#9c8f78',
      primary: '#f0b429', primaryDark: '#c68f14', primaryBg: '#241a05', primarySoft: '#2e2410',
    },
    light: {
      bg: '#faf6ee', surface: '#ffffff', surfaceAlt: '#f0e8d4', border: '#e2d5b8', borderStrong: '#d0bf98',
      text: '#211c10', textMuted: '#6d5f45', textDim: '#7d6f52',
      primary: '#b8860a', primaryDark: '#8a660a', primaryBg: '#241a05', primarySoft: '#f7e8c2',
    },
  },
  masterball: {
    label: 'Master Ball',
    swatch: '#9750e0',
    overlayRgb: '20, 10, 31',
    dark: {
      bg: '#140a1f', surface: '#201431', surfaceAlt: '#2c1d42', border: '#3d2a5a', borderStrong: '#503a70',
      text: '#f3ecfb', textMuted: '#b8a0d9', textDim: '#9f87c2',
      primary: '#9750e0', primaryDark: '#7333b8', primaryBg: '#24123d', primarySoft: '#301f47',
    },
    light: {
      bg: '#f8f3fc', surface: '#ffffff', surfaceAlt: '#ede0f7', border: '#ddc9ef', borderStrong: '#c7a8e3',
      text: '#1f1330', textMuted: '#5c4a75', textDim: '#6d5a87',
      primary: '#7333b8', primaryDark: '#55238a', primaryBg: '#24123d', primarySoft: '#ecdff9',
    },
  },
  healball: {
    label: 'Heal Ball',
    swatch: '#f28fb0',
    overlayRgb: '31, 16, 21',
    dark: {
      bg: '#1f1015', surface: '#2b1720', surfaceAlt: '#3a1f2b', border: '#4d2c3a', borderStrong: '#63394a',
      text: '#fbe9f0', textMuted: '#d9a8bc', textDim: '#c091a6',
      primary: '#f28fb0', primaryDark: '#d1467e', primaryBg: '#3d1a2a', primarySoft: '#3a2530',
    },
    light: {
      bg: '#fdf3f6', surface: '#ffffff', surfaceAlt: '#fce7ee', border: '#f6d3e0', borderStrong: '#eeb9cf',
      text: '#3a2430', textMuted: '#8a6b78', textDim: '#7d5d6a',
      primary: '#d1467e', primaryDark: '#a8355f', primaryBg: '#3d1a2a', primarySoft: '#fbdce6',
    },
  },
};

export const PALETTE_META: Record<PaletteId, { label: string; swatch: string }> =
  Object.fromEntries(PALETTE_ORDER.map(id => [id, { label: PALETTES[id].label, swatch: PALETTES[id].swatch }])) as Record<PaletteId, { label: string; swatch: string }>;

const semanticDark = {
  success: '#34d399', successBg: '#0b3d2e',
  danger: '#f2994a', dangerBg: '#4a2c12',
  warning: '#fbbf24',
  backdrop: 'rgba(0, 0, 0, 0.7)',
};

const semanticLight = {
  success: '#0f9d6e', successBg: '#dcf5ea',
  danger: '#a8560c', dangerBg: '#fbe9d6',
  warning: '#b8790a',
  backdrop: 'rgba(0, 0, 0, 0.5)',
};

function buildTokens(id: PaletteId, mode: ThemeMode): ColorTokens {
  const def = PALETTES[id];
  const semantic = mode === 'dark' ? semanticDark : semanticLight;
  const overlayAlpha = mode === 'dark' ? 0.85 : 0.8;
  return {
    ...(mode === 'dark' ? def.dark : def.light),
    ...semantic,
    overlay: `rgba(${def.overlayRgb}, ${overlayAlpha})`,
  };
}

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
const PALETTE_STORAGE_KEY = 'color_palette';

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

async function getStoredPalette(): Promise<PaletteId | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(PALETTE_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(PALETTE_STORAGE_KEY);
  return raw && (PALETTE_ORDER as string[]).includes(raw) ? raw as PaletteId : null;
}

async function setStoredPalette(id: PaletteId): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PALETTE_STORAGE_KEY, id);
    return;
  }
  await SecureStore.setItemAsync(PALETTE_STORAGE_KEY, id);
}

interface ThemeContextValue {
  mode: ThemeMode;
  palette: PaletteId;
  colors: ColorTokens;
  shadow: ShadowTokens;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setPalette: (id: PaletteId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === 'light' ? 'light' : 'dark');
  const [palette, setPaletteState] = useState<PaletteId>('pokeball');

  // Apply persisted overrides once storage resolves; a same-render flash if they differ
  // from the defaults is an acceptable trade-off over blocking the whole app on it.
  useEffect(() => {
    let alive = true;
    getStoredMode().then(stored => { if (alive && stored) setModeState(stored); });
    getStoredPalette().then(stored => { if (alive && stored) setPaletteState(stored); });
    return () => { alive = false; };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setStoredMode(next);
  };
  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');
  const setPalette = (id: PaletteId) => {
    setPaletteState(id);
    setStoredPalette(id);
  };

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    palette,
    colors: buildTokens(palette, mode),
    shadow: mode === 'dark' ? darkShadow : lightShadow,
    setMode,
    toggleMode,
    setPalette,
  }), [mode, palette]);

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
