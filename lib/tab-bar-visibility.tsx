import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useMotion } from './motion';
import { SCREEN_FAB_CLEARANCE } from './theme';

// Slide distance for the floating tab bar AND the global search/"more" FABs
// (app/(app)/_layout.tsx) — all three share this same translateY. Used to be
// tuned only for the tab bar's own extent (62 tall + 16 bottom inset = 78),
// which quietly under-cleared the FABs (86 bottom inset + 44 tall = 130) by
// ~32px — invisible while hiding was only ever transient (mid-scroll, no one
// looks closely at a fraction-of-a-second sliver), but a real visible gap
// once something hides them permanently (the national Pokédex's page-view
// "contemplation" mode, confirmed live 2026-09-24). SCREEN_FAB_CLEARANCE
// (lib/theme.tsx) already clears this exact same FAB stack for a different
// purpose (screen-level FABs stacking above it) — reusing it here instead of
// a second hand-tuned literal that could drift out of sync with it again.
export const TAB_BAR_HIDE_OFFSET = SCREEN_FAB_CLEARANCE + 20;

const SCROLL_JITTER_PX = 4;
const BOTTOM_EPSILON_PX = 24;
const NEAR_TOP_PX = 20;
const IDLE_MS = 300;
const ANIM_MS = 220;

interface TabBarVisibilityValue {
  translateY: Animated.Value;
  show: () => void;
  hide: () => void;
  handleScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const { animationsEnabled } = useMotion();
  const animationsEnabledRef = useRef(animationsEnabled);
  animationsEnabledRef.current = animationsEnabled;

  const translateY = useRef(new Animated.Value(0)).current;
  const hiddenRef = useRef(false);
  const lastOffsetYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateTo = (hidden: boolean) => {
    if (hidden === hiddenRef.current) return;
    hiddenRef.current = hidden;
    const toValue = hidden ? TAB_BAR_HIDE_OFFSET : 0;
    if (!animationsEnabledRef.current) {
      translateY.setValue(toValue);
      return;
    }
    Animated.timing(translateY, { toValue, duration: ANIM_MS, useNativeDriver: true }).start();
  };

  const show = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    animateTo(false);
  };

  // For screens that want the bar (and the FABs sharing this same
  // translateY, see app/(app)/_layout.tsx) fully out of the way on demand —
  // the "contemplation" page-view mode of the national Pokédex, not driven
  // by scroll at all. Also clears any pending idle-timer re-show so it
  // doesn't immediately undo this a moment later.
  const hide = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    animateTo(true);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const delta = y - lastOffsetYRef.current;
    lastOffsetYRef.current = y;

    const atBottom = y + layoutMeasurement.height >= contentSize.height - BOTTOM_EPSILON_PX;
    const nearTop = y < NEAR_TOP_PX;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(show, IDLE_MS);

    if (atBottom || nearTop) {
      animateTo(false);
    } else if (Math.abs(delta) > SCROLL_JITTER_PX) {
      animateTo(true);
    }
  };

  const value = useMemo<TabBarVisibilityValue>(() => ({ translateY, show, hide, handleScroll }), [translateY]);
  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useTabBarVisibility(): TabBarVisibilityValue {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  return ctx;
}

// Spread directly onto a FlashList/FlatList/ScrollView to make it drive the
// shared floating tab bar's hide/show state — same event shape across all
// three components, so one handler covers every scrollable screen.
export function useHideOnScrollProps() {
  const { handleScroll } = useTabBarVisibility();
  return { onScroll: handleScroll, scrollEventThrottle: 16 };
}
