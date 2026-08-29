import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/lib/theme';

const SLIDE_DURATION = 300; // ms
const SLIDE_OFFSET = spacing.xl; // 24 — reuse an existing token instead of a new magic number

interface Props {
  transitionKey: string | number;
  /** null = no directional context (direct load / deep link) — static, no animation. */
  direction: 'left' | 'right' | null;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Content-level slide+fade, replayed via a plain useEffect keyed on
// transitionKey — never unmounts children itself, so callers that stay
// mounted across navigations (see app/(app)/_layout.tsx's Tabs.Screen entries,
// no unmountOnBlur) keep their scroll position / local state intact. A rapid
// change mid-animation just resets and restarts cleanly (anim.stop() on
// cleanup), never leaves the content stuck off-position.
export function SlideTransition({ transitionKey, direction, style, children }: Props) {
  const progress = useRef(new Animated.Value(direction ? 0 : 1)).current;

  useEffect(() => {
    if (!direction) { progress.setValue(1); return; }

    const start = () => {
      progress.setValue(0);
      const anim = Animated.timing(progress, {
        toValue: 1, duration: SLIDE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      });
      anim.start();
      return anim;
    };

    // On native, useNativeDriver: true is truly isolated on the UI thread —
    // no reason to delay, and delaying is actively harmful: whatever screen
    // this wraps becomes visible (tab focus / mount) in the same commit as
    // this effect, so any gap before we reset+start leaves it showing its
    // *previous* settled frame (opacity 1 from last time it was visible)
    // before snapping through the reset — that flash of stale content was
    // reported on the Android build. Reset+start synchronously here.
    if (Platform.OS !== 'web') {
      const anim = start();
      return () => anim.stop();
    }

    // On web there's no true native driver — Animated.timing's clock runs on
    // the same JS thread as the heavy synchronous mount/layout work this
    // content just triggered, so starting immediately let that first paint
    // eat most of the animation budget (looked like a jump, not a slide).
    // Deferring two frames lets that paint land first. Reset has to be
    // deferred right alongside the start (not fired eagerly) so there's no
    // window where the browser paints "reset but not yet animating".
    // Triple-rAF, not double — PokedexGrid's scroll-fade state (added
    // alongside the binder-style page view) made the content this wraps
    // heavier to mount, which was enough to occasionally push the first
    // paint past the previous 2-frame margin and reintroduce the exact
    // flash this deferral exists to prevent. One more frame of headroom.
    let anim: Animated.CompositeAnimation | null = null;
    let raf2 = 0;
    let raf3 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        raf3 = requestAnimationFrame(() => {
          anim = start();
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(raf3);
      anim?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey]);

  const offsetX = direction === 'right' ? SLIDE_OFFSET : direction === 'left' ? -SLIDE_OFFSET : 0;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [offsetX, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}
