import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Very light diagonal light sweep, reverse holo only — the FINISH_GRADIENT
// silver border (lib/finish-visuals.ts) already sets reverse apart from a
// plain owned card, but next to holo's own gold shimmer it read as flat.
// This adds a soft foil-style highlight across the card face itself, not
// just the border. Static (no animation loop) — cheap enough to render on
// every reverse-holo tile in a large grid/binder without a perf cost.
export function ReverseHoloShimmer() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
      locations={[0.35, 0.5, 0.65]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
