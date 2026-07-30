import { useRef } from 'react';
import { Animated } from 'react-native';
import { useMotion } from './motion';

// Shared tactile feedback for frameless tappable elements (hero ring, floating
// section rows) — spring the whole thing down slightly on press, back up on
// release. Consolidates what PokedexHeroCard and the old boxed Bubble each
// implemented inline with identical spring constants.
export function usePressSpring(pressedScale = 0.97) {
  const { animationsEnabled } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (!animationsEnabled) return;
    Animated.spring(scale, { toValue: pressedScale, friction: 6, tension: 120, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (!animationsEnabled) return;
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  };
  return { scale, pressIn, pressOut };
}
