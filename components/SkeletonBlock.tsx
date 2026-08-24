import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, radius } from '@/lib/theme';

interface Props {
  style?: StyleProp<ViewStyle>;
}

// A single rounded placeholder with a looping diagonal shimmer sweep, same
// gradient-band technique as ReverseHoloShimmer but looped instead of
// one-shot. Reused across every "loading" list/grid in the app instead of a
// bare ActivityIndicator, so the shape of what's coming is legible while it loads.
export function SkeletonBlock({ style }: Props) {
  const { colors } = useTheme();
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: ['-100%', '100%'] });

  return (
    <Animated.View style={[{ borderRadius: radius.md, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', colors.surface, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}
