import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { ProgressRing } from './ProgressRing';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  label: string;
  owned: number;
  total: number;
  color?: string;
  size?: number;
  icon?: ReactNode;
  hideCaption?: boolean;
  onPress?: () => void;
}

export function StatRingTile({ label, owned, total, color, size = 64, icon, hideCaption, onPress }: Props) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.primary;
  const styles = useThemedStyles((colors) => ({
    tile: { width: 92, alignItems: 'center' as const, gap: 4, padding: spacing.xs, borderRadius: radius.md },
    tilePressed: { backgroundColor: colors.surfaceAlt },
    label: { fontSize: 11, color: colors.text, fontFamily: fonts.bodyBold, textAlign: 'center' as const },
    count: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.mono },
  }));
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${label} : ${pct}%, ${owned}/${total}`}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <ProgressRing
        pct={pct} size={size} strokeWidth={Math.max(5, Math.round(size * 0.13))} color={ringColor}
        centerLabel={icon ? undefined : `${pct}%`}>
        {icon}
      </ProgressRing>
      {!hideCaption && (
        icon ? (
          <Text style={styles.count}>{pct}% · {owned}/{total}</Text>
        ) : (
          <>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
            <Text style={styles.count}>{owned}/{total}</Text>
          </>
        )
      )}
    </Pressable>
  );
}
