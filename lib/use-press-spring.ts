import { useRef } from 'react';
import { Animated } from 'react-native';

// Shared tactile feedback for frameless tappable elements (hero ring, floating
// section rows) — spring the whole thing down slightly on press, back up on
// release. Consolidates what PokedexHeroCard and the old boxed Bubble each
// implemented inline with identical spring constants.
export function usePressSpring(pressedScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: pressedScale, friction: 6, tension: 120, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  return { scale, pressIn, pressOut };
}
