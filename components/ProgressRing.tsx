import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/lib/theme';

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
  pct, size = 64, strokeWidth = 8, color = colors.primary, trackColor = colors.surfaceAlt,
  centerLabel, centerSub, children,
}: Props) {
  const clamped = Math.min(100, Math.max(0, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - clamped / 100);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={cx} cy={cy} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
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
          {centerLabel && <Text style={[styles.centerLabel, { fontSize: size * 0.2 }]} numberOfLines={1}>{centerLabel}</Text>}
          {centerSub && <Text style={[styles.centerSub, { fontSize: size * 0.11 }]} numberOfLines={1}>{centerSub}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  centerLabel: { fontWeight: '800', color: colors.text },
  centerSub: { color: colors.textMuted, marginTop: 2 },
});
