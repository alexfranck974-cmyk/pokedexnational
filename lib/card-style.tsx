import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Device-local visual-treatment preference for card tiles (CardTile/
// CardListRow) — same storage pattern as lib/motion.tsx/lib/hud-density.tsx.
// Unlike hud-density (which controls how much INFO shows), this controls how
// the chrome/badges around a card are drawn — orthogonal axes, both apply at
// once. Chosen from 3 mockup directions the user picked to keep available
// side-by-side rather than commit to one, the same way PALETTE_ORDER in
// lib/theme.tsx keeps 6 color schemes selectable instead of picking one.
export type CardStyle = 'badge' | 'reveal' | 'flat';
export const CARD_STYLE_ORDER: CardStyle[] = ['badge', 'reveal', 'flat'];

const CARD_STYLE_STORAGE_KEY = 'card_style';

function isCardStyle(v: string | null): v is CardStyle {
  return v === 'badge' || v === 'reveal' || v === 'flat';
}

async function getStoredStyle(): Promise<CardStyle | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(CARD_STYLE_STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(CARD_STYLE_STORAGE_KEY);
  return isCardStyle(raw) ? raw : null;
}

async function setStoredStyle(style: CardStyle): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CARD_STYLE_STORAGE_KEY, style);
    return;
  }
  await SecureStore.setItemAsync(CARD_STYLE_STORAGE_KEY, style);
}

interface CardStyleContextValue {
  cardStyle: CardStyle;
  setCardStyle: (style: CardStyle) => void;
}

const CardStyleContext = createContext<CardStyleContextValue | null>(null);

export function CardStyleProvider({ children }: { children: ReactNode }) {
  // 'badge' ("Indicateur unique") is the default — closest to today's look
  // (single consolidated badge instead of the four that used to overlap),
  // so existing users land somewhere calmer without an opt-in step.
  const [cardStyle, setCardStyleState] = useState<CardStyle>('badge');

  useEffect(() => {
    let alive = true;
    getStoredStyle().then(stored => { if (alive && stored !== null) setCardStyleState(stored); });
    return () => { alive = false; };
  }, []);

  const setCardStyle = (next: CardStyle) => {
    setCardStyleState(next);
    setStoredStyle(next);
  };

  const value = useMemo<CardStyleContextValue>(() => ({ cardStyle, setCardStyle }), [cardStyle]);
  return <CardStyleContext.Provider value={value}>{children}</CardStyleContext.Provider>;
}

export function useCardStyle(): CardStyleContextValue {
  const ctx = useContext(CardStyleContext);
  if (!ctx) throw new Error('useCardStyle must be used within CardStyleProvider');
  return ctx;
}
