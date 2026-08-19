import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { STRINGS, type StringKey } from './strings';

export type Locale = 'fr' | 'en';

const LOCALE_STORAGE_KEY = 'app_locale';

async function getStoredLocale(): Promise<Locale | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
  return raw === 'fr' || raw === 'en' ? raw : null;
}

async function setStoredLocale(locale: Locale): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return;
  }
  await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // No OS-language auto-detection — the app has only ever defaulted to French,
  // and an auto-detected default would surprise existing users. Same
  // apply-after-storage-resolves trade-off as ThemeProvider/MotionProvider.
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    let alive = true;
    getStoredLocale().then(stored => { if (alive && stored) setLocaleState(stored); });
    return () => { alive = false; };
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  };

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

/** Flat dictionary lookup with `{placeholder}` interpolation — no plural-rule
 * engine; the handful of FR plural cases in this app pick between two whole
 * pre-pluralized keys client-side (same pattern already used with raw strings
 * before this hook existed), since FR and EN both just append "s" here. */
export function useT() {
  const { locale } = useLocale();
  return (key: StringKey, params?: Record<string, string | number>) => {
    let str: string = STRINGS[locale][key] ?? STRINGS.fr[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) str = str.replaceAll(`{${k}}`, String(v));
    }
    return str;
  };
}

/** Like useT(), but for the rare sentence that needs one name rendered as a
 * styled inline <Text> instead of plain interpolated text — e.g. "**{name}**
 * te propose un échange". The dictionary entry wraps that one placeholder in
 * `**`; this splits the already-interpolated string on `**...**` and wraps
 * each captured run in a <Text style={boldStyle}>. Only handles one bold run
 * per string (the one real case in this app) — not a general rich-text engine. */
export function useTRich() {
  const t = useT();
  return (key: StringKey, params: Record<string, string | number>, boldStyle: StyleProp<TextStyle>): ReactNode[] => {
    const raw = t(key, params);
    return raw.split(/(\*\*.+?\*\*)/g).filter(Boolean).map((part, i) => {
      const m = part.match(/^\*\*(.+)\*\*$/);
      return m ? <Text key={i} style={boldStyle}>{m[1]}</Text> : part;
    });
  };
}
