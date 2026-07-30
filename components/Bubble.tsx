import { useRef, type ReactNode } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { withAlpha } from '@/lib/color-utils';
import { useTheme, radius, spacing } from '@/lib/theme';

interface Props {
  /** Accent color: top seam stripe + tinted glow shadow. */
  tint: string;
  /** When provided, the whole bubble becomes pressable with a spring scale-down feedback. Omit for container bubbles whose children have their own tap targets. */
  onPress?: () => void;
  children: ReactNode;
  style?: object;
}

// Apriball-style shell: translucent glass body, a thin colored seam at the top like
// a capsule cap, and a soft tinted glow instead of a flat black shadow. The outer
// View carries the (unclipped) shadow; the inner one clips the seam to the corners.
export function Bubble({ tint, onPress, children, style }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => Animated.spring(scale, { toValue: 0.97, friction: 6, tension: 120, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();

  const outer = {
    borderRadius: radius.bubble,
    shadowColor: tint,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  };
  const inner = {
    borderRadius: radius.bubble,
    overflow: 'hidden' as const,
    backgroundColor: withAlpha(colors.surface, 0.82),
    borderWidth: 1,
    borderColor: withAlpha(colors.border, 0.5),
  };
  const seam = { height: 4, backgroundColor: tint };
  const body = { padding: spacing.md };

  const content = (
    <View style={[outer, style]}>
      <View style={inner}>
        <View style={seam} />
        <View style={body}>{children}</View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {content}
      </Animated.View>
    </Pressable>
  );
}
