import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /** Per-palette "foil" highlight — a second, contrasting hue reserved for one glow/ring
   *  detail per component (selected palette swatch, pinned-goal badge), never a fill.
   *  `sobre` sets this close to its own border tone on purpose, so the glow is a no-op. */
  primaryGlint: string;

  success: string;
  successBg: string;

  danger: string;
  dangerBg: string;

  warning: string;
  warningBg: string;

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
export type PaletteId = 'pokeball' | 'greatball' | 'ultraball' | 'masterball' | 'healball' | 'luxuryball' | 'sobre';

export const PALETTE_ORDER: PaletteId[] = ['pokeball', 'greatball', 'ultraball', 'masterball', 'healball', 'luxuryball', 'sobre'];

type NeutralAccentTokens = Pick<ColorTokens,
  | 'bg' | 'surface' | 'surfaceAlt' | 'border' | 'borderStrong'
  | 'text' | 'textMuted' | 'textDim'
  | 'primary' | 'primaryDark' | 'primaryBg' | 'primarySoft' | 'primaryGlint'>;

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
    swatch: '#e8324c',
    overlayRgb: '20, 16, 15',
    dark: {
      bg: '#14100f', surface: '#1f1917', surfaceAlt: '#2b221f', border: '#3a2d29', borderStrong: '#4d3a34',
      text: '#f6f0ec', textMuted: '#b8a89e', textDim: '#9a8579',
      primary: '#e8324c', primaryDark: '#b8283a', primaryBg: '#3d1219', primarySoft: '#3a2026', primaryGlint: '#ffd166',
    },
    light: {
      bg: '#faf5f1', surface: '#ffffff', surfaceAlt: '#f0e6df', border: '#e6d8cd', borderStrong: '#d8c4b5',
      text: '#211613', textMuted: '#6d5c53', textDim: '#7d6c62',
      primary: '#d81f3b', primaryDark: '#8a1424', primaryBg: '#3d1219', primarySoft: '#fbe2e5', primaryGlint: '#c98a1f',
    },
  },
  greatball: {
    label: 'Great Ball',
    swatch: '#2f86e0',
    overlayRgb: '13, 20, 32',
    dark: {
      bg: '#0d1420', surface: '#16202f', surfaceAlt: '#1f2d40', border: '#2b3c52', borderStrong: '#3a4f6c',
      text: '#eef3fa', textMuted: '#a9bad0', textDim: '#8fa0b8',
      primary: '#2f86e0', primaryDark: '#2a5aa8', primaryBg: '#0f2038', primarySoft: '#1a2c42', primaryGlint: '#7be0ff',
    },
    light: {
      bg: '#f2f6fb', surface: '#ffffff', surfaceAlt: '#e4edf7', border: '#d3e0ef', borderStrong: '#b9cce4',
      text: '#14202f', textMuted: '#4d5f75', textDim: '#64758a',
      primary: '#1f66c2', primaryDark: '#1c3f7a', primaryBg: '#0f2038', primarySoft: '#e0ecfa', primaryGlint: '#1f9dbf',
    },
  },
  ultraball: {
    label: 'Ultra Ball',
    swatch: '#ffcc33',
    overlayRgb: '12, 11, 10',
    dark: {
      bg: '#0c0b0a', surface: '#1a1714', surfaceAlt: '#241f1a', border: '#362f27', borderStrong: '#4a3f33',
      text: '#f7f1e6', textMuted: '#b8a98f', textDim: '#9c8f78',
      primary: '#ffcc33', primaryDark: '#c68f14', primaryBg: '#241a05', primarySoft: '#2e2410', primaryGlint: '#fff4c2',
    },
    light: {
      bg: '#faf6ee', surface: '#ffffff', surfaceAlt: '#f0e8d4', border: '#e2d5b8', borderStrong: '#d0bf98',
      text: '#211c10', textMuted: '#6d5f45', textDim: '#7d6f52',
      primary: '#c99a0a', primaryDark: '#8a660a', primaryBg: '#241a05', primarySoft: '#f7e8c2', primaryGlint: '#8a6a12',
    },
  },
  masterball: {
    label: 'Master Ball',
    swatch: '#a855f0',
    overlayRgb: '20, 10, 31',
    dark: {
      bg: '#140a1f', surface: '#201431', surfaceAlt: '#2c1d42', border: '#3d2a5a', borderStrong: '#503a70',
      text: '#f3ecfb', textMuted: '#b8a0d9', textDim: '#9f87c2',
      primary: '#a855f0', primaryDark: '#7333b8', primaryBg: '#24123d', primarySoft: '#301f47', primaryGlint: '#ff9ad1',
    },
    light: {
      bg: '#f8f3fc', surface: '#ffffff', surfaceAlt: '#ede0f7', border: '#ddc9ef', borderStrong: '#c7a8e3',
      text: '#1f1330', textMuted: '#5c4a75', textDim: '#6d5a87',
      primary: '#8a3ecf', primaryDark: '#55238a', primaryBg: '#24123d', primarySoft: '#ecdff9', primaryGlint: '#c94f9e',
    },
  },
  healball: {
    label: 'Heal Ball',
    swatch: '#ff8fb8',
    overlayRgb: '31, 16, 21',
    dark: {
      bg: '#1f1015', surface: '#2b1720', surfaceAlt: '#3a1f2b', border: '#4d2c3a', borderStrong: '#63394a',
      text: '#fbe9f0', textMuted: '#d9a8bc', textDim: '#c091a6',
      primary: '#ff8fb8', primaryDark: '#d1467e', primaryBg: '#3d1a2a', primarySoft: '#3a2530', primaryGlint: '#ffe3ee',
    },
    light: {
      bg: '#fdf3f6', surface: '#ffffff', surfaceAlt: '#fce7ee', border: '#f6d3e0', borderStrong: '#eeb9cf',
      text: '#3a2430', textMuted: '#8a6b78', textDim: '#7d5d6a',
      primary: '#c93b74', primaryDark: '#a8355f', primaryBg: '#3d1a2a', primarySoft: '#fbdce6', primaryGlint: '#8a2f52',
    },
  },
  luxuryball: {
    label: 'Luxury Ball',
    swatch: '#c98a52',
    overlayRgb: '10, 9, 7',
    dark: {
      bg: '#0a0908', surface: '#161310', surfaceAlt: '#211c16', border: '#332b20', borderStrong: '#4a3f2c',
      text: '#f5efe0', textMuted: '#c2b393', textDim: '#a3966f',
      primary: '#c98a52', primaryDark: '#9c6636', primaryBg: '#2b2005', primarySoft: '#33241a', primaryGlint: '#f3d9c4',
    },
    light: {
      bg: '#faf7ee', surface: '#ffffff', surfaceAlt: '#f2ead0', border: '#e2d3a0', borderStrong: '#cbb772',
      text: '#1a1610', textMuted: '#6b5d3f', textDim: '#7d6f4d',
      primary: '#9c6a3a', primaryDark: '#7a4f26', primaryBg: '#2b2005', primarySoft: '#f2e4d3', primaryGlint: '#a8637a',
    },
  },
  sobre: {
    label: 'Sobre',
    swatch: '#8f8f8f',
    overlayRgb: '18, 18, 18',
    dark: {
      bg: '#121212', surface: '#1c1c1c', surfaceAlt: '#262626', border: '#333333', borderStrong: '#454545',
      text: '#f2f2f2', textMuted: '#a8a8a8', textDim: '#888888',
      primary: '#4a4a4a', primaryDark: '#333333', primaryBg: '#1e1e1e', primarySoft: '#2a2a2a', primaryGlint: '#3a3a3a',
    },
    light: {
      bg: '#fafafa', surface: '#ffffff', surfaceAlt: '#eeeeee', border: '#dddddd', borderStrong: '#c7c7c7',
      text: '#161616', textMuted: '#5c5c5c', textDim: '#7a7a7a',
      primary: '#2a2a2a', primaryDark: '#000000', primaryBg: '#1e1e1e', primarySoft: '#ececec', primaryGlint: '#d8d8d8',
    },
  },
};

export const PALETTE_META: Record<PaletteId, { label: string; swatch: string; glint: string }> =
  Object.fromEntries(PALETTE_ORDER.map(id => [id, {
    label: PALETTES[id].label, swatch: PALETTES[id].swatch, glint: PALETTES[id].dark.primaryGlint,
  }])) as Record<PaletteId, { label: string; swatch: string; glint: string }>;

const semanticDark = {
  success: '#34d399', successBg: '#0b3d2e',
  danger: '#f2994a', dangerBg: '#4a2c12',
  warning: '#fbbf24', warningBg: '#3d2f06',
  backdrop: 'rgba(0, 0, 0, 0.7)',
};

const semanticLight = {
  success: '#0f9d6e', successBg: '#dcf5ea',
  danger: '#a8560c', dangerBg: '#fbe9d6',
  warning: '#b8790a', warningBg: '#f9edd0',
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
  },
  md: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 4,
  },
};

const lightShadow: ShadowTokens = {
  sm: {
    shadowColor: '#3a2320', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  md: {
    shadowColor: '#3a2320', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 4,
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
  /** Screen hero band background (3 identical stops — a flat colors.surface
   *  fill via LinearGradient, not an actual gradient; every existing hero
   *  consumer already renders via LinearGradient, so this is a same-shape
   *  drop-in). Used to be a bold 3-tone gradient (colors.primaryBg ->
   *  primaryDark -> primary) repeated at the top of ~10 screens — flattened
   *  2026-09-20 as part of the visual-redesign track's "calm down the color"
   *  pass. Dashboard deliberately never consumed this token (it has its own
   *  blurred-vitrine-backdrop hero instead), so it's untouched and keeps
   *  its existing visual punch — the one screen the user wanted to keep it. */
  heroGradient: [string, string, string];
  /** Hero title/icon color — white in dark mode, colors.text in light mode. */
  heroText: string;
  /** Hero subtitle/caption color — translucent white in dark mode, colors.textMuted in light mode. */
  heroTextMuted: string;
  /** Translucent pill/avatar background sitting on the hero (inactive toggle state). */
  heroSurface: string;
  /** Solid pill background for the active/selected state of a hero toggle. */
  heroSurfaceActive: string;
  /** Icon/text color drawn on top of heroSurfaceActive — contrasts with it. */
  heroSurfaceActiveText: string;
  /** Translucent progress-ring track color drawn on the hero. */
  heroTrack: string;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setPalette: (id: PaletteId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === 'light' ? 'light' : 'dark');
  const [palette, setPaletteState] = useState<PaletteId>('pokeball');
  // Whether the user has an explicit stored preference (Settings toggle) —
  // until we know, the OS scheme should keep winning; once we know, it should
  // never be silently overridden by a later OS-scheme read.
  const hasExplicitMode = useRef(false);

  // Apply persisted overrides once storage resolves; a same-render flash if they differ
  // from the defaults is an acceptable trade-off over blocking the whole app on it.
  // Both reads are allowed to fail silently (e.g. Android Keystore invalidation) —
  // falling back to the OS scheme below is better than leaving `mode` on whatever
  // note it was left at only because of a rejected promise.
  useEffect(() => {
    let alive = true;
    getStoredMode().then(stored => {
      if (!alive) return;
      if (stored) { hasExplicitMode.current = true; setModeState(stored); }
    }).catch(() => {});
    getStoredPalette().then(stored => { if (alive && stored) setPaletteState(stored); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // useColorScheme() commonly reports `undefined` on the very first render
  // (native Appearance value not bridged over yet — more pronounced on
  // Android/Expo Go) before resolving to the real OS scheme on a later
  // render. The initial useState above only runs once and would otherwise
  // permanently lock a first-time user into 'dark' if that first read missed.
  // Re-sync whenever the OS scheme changes, but only while no explicit
  // Settings-toggle preference has been loaded/set.
  useEffect(() => {
    if (hasExplicitMode.current) return;
    if (systemScheme === 'light' || systemScheme === 'dark') setModeState(systemScheme);
  }, [systemScheme]);

  const setMode = (next: ThemeMode) => {
    hasExplicitMode.current = true;
    setModeState(next);
    setStoredMode(next);
  };
  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');
  const setPalette = (id: PaletteId) => {
    setPaletteState(id);
    setStoredPalette(id);
  };

  const value = useMemo<ThemeContextValue>(() => {
    const colors = buildTokens(palette, mode);
    const heroGradient: [string, string, string] = [colors.surface, colors.surface, colors.surface];
    return {
      mode,
      palette,
      colors,
      shadow: mode === 'dark' ? darkShadow : lightShadow,
      heroGradient,
      heroText: mode === 'dark' ? '#ffffff' : colors.text,
      heroTextMuted: mode === 'dark' ? 'rgba(255,255,255,0.75)' : colors.textMuted,
      heroSurface: mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
      heroSurfaceActive: mode === 'dark' ? '#ffffff' : colors.primary,
      heroSurfaceActiveText: mode === 'dark' ? colors.primary : '#ffffff',
      heroTrack: mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)',
      setMode,
      toggleMode,
      setPalette,
    };
  }, [mode, palette]);

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
