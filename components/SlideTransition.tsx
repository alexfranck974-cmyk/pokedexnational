import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
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
    progress.setValue(0);
    // Double-rAF before starting: the content this wraps just mounted/updated
    // in this same commit, and that layout+paint work competes with the JS
    // thread that Animated.timing's clock runs on under react-native-web (no
    // true native driver on web — useNativeDriver here just avoids a warning,
    // it doesn't get the animation off the JS thread). Starting immediately
    // meant the heavy first paint could eat most of the 220ms budget before
    // the browser got a chance to render an intermediate frame, so the
    // "animation" was really just a jump. Waiting two frames lets that first
    // paint land first, so the full duration is available for the visible part.
    let anim: Animated.CompositeAnimation | null = null;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        anim = Animated.timing(progress, {
          toValue: 1, duration: SLIDE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        });
        anim.start();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
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
