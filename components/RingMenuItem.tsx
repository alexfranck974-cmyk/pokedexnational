import type { ReactNode } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { ProgressRing } from './ProgressRing';
import { withAlpha } from '@/lib/color-utils';
import { useTheme, useThemedStyles, spacing, fonts } from '@/lib/theme';
import { usePressSpring } from '@/lib/use-press-spring';

interface Props {
  tint: string;
  size?: number;
  /** Omit for content with no meaningful completion ratio (e.g. a suggestions
   * count) — renders a static outlined circle instead of a progress arc, so
   * it doesn't imply a percentage that isn't real. */
  pct?: number;
  centerLabel: string;
  centerSub?: string;
  label: string;
  /** Small overlay in the ring's corner (e.g. an "add" affordance). */
  badge?: ReactNode;
  onPress: () => void;
}

// A ring-shaped menu entry: floating, no card frame, tinted glow behind it —
// the same visual language as the Dashboard hero ring, scaled down to act as
// a tappable menu item instead of the single "main" ring.
export function RingMenuItem({ tint, size = 64, pct, centerLabel, centerSub, label, badge, onPress }: Props) {
  const { colors } = useTheme();
  const { scale, pressIn, pressOut } = usePressSpring();
  const styles = useThemedStyles((colors) => ({
    wrap: { alignItems: 'center' as const, gap: spacing.xs },
    // backgroundColor is near-invisible (2% alpha) rather than fully transparent
    // — Android's elevation shadow often doesn't render on a fully transparent
    // view, this gives it something to light.
    glow: {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: withAlpha(colors.bg, 0.02),
      shadowColor: tint, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8,
    },
    staticRing: {
      width: size, height: size, borderRadius: size / 2, borderWidth: 4,
      borderColor: withAlpha(tint, 0.4), backgroundColor: withAlpha(tint, 0.1),
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    staticLabel: { fontSize: size * 0.28, fontFamily: fonts.monoBold, color: tint },
    staticSub: { fontSize: size * 0.15, fontFamily: fonts.mono, color: colors.textMuted, marginTop: 1 },
    label: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
  }));

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
        <View>
          <View style={styles.glow}>
            {pct !== undefined ? (
              <ProgressRing pct={pct} size={size} strokeWidth={7} color={tint} centerLabel={centerLabel} centerSub={centerSub} />
            ) : (
              <View style={styles.staticRing}>
                <Text style={styles.staticLabel}>{centerLabel}</Text>
                {centerSub && <Text style={styles.staticSub}>{centerSub}</Text>}
              </View>
            )}
          </View>
          {badge}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
