import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme, useThemedStyles, fonts } from '@/lib/theme';

interface Props {
  pct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  centerLabel?: string;
  centerSub?: string;
  children?: ReactNode;
}

export function ProgressRing({
  pct, size = 64, strokeWidth = 8, color, trackColor,
  centerLabel, centerSub, children,
}: Props) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.primary;
  const ringTrackColor = trackColor ?? colors.surfaceAlt;
  const styles = useThemedStyles((colors) => ({
    center: { alignItems: 'center' as const, justifyContent: 'center' as const },
    centerLabel: { fontFamily: fonts.monoBold, color: colors.text },
    centerSub: { fontFamily: fonts.mono, color: colors.textMuted, marginTop: 2 },
  }));

  const clamped = Math.min(100, Math.max(0, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - clamped / 100);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke={ringTrackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={cx} cy={cy} r={radius} stroke={ringColor} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      {(centerLabel || centerSub || children) && (
        <View style={[StyleSheet.absoluteFillObject, styles.center]} pointerEvents="none">
          {children}
          {centerLabel && (
            <Text style={[styles.centerLabel, { fontSize: size * 0.2 }]} numberOfLines={1}>
              {centerLabel}
            </Text>
          )}
          {centerSub && (
            <Text style={[styles.centerSub, { fontSize: size * 0.11 }]} numberOfLines={1}>
              {centerSub}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
