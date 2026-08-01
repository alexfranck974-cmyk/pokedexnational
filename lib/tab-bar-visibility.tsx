import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useMotion } from './motion';

// Slide distance for the floating tab bar / settings FAB — clears the pill's
// own height + its bottom inset + a little extra so no sliver stays visible.
// Matches BAR_HEIGHT (62) + BAR_BOTTOM_OFFSET (16, = spacing.lg) from
// app/(app)/_layout.tsx, kept as a literal here to avoid a circular import.
export const TAB_BAR_HIDE_OFFSET = 62 + 16 + 20;

const SCROLL_JITTER_PX = 4;
const BOTTOM_EPSILON_PX = 24;
const NEAR_TOP_PX = 20;
const IDLE_MS = 300;
const ANIM_MS = 220;

interface TabBarVisibilityValue {
  translateY: Animated.Value;
  show: () => void;
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

  const value = useMemo<TabBarVisibilityValue>(() => ({ translateY, show, handleScroll }), [translateY]);
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
