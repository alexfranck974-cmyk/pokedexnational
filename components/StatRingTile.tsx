import type { ReactNode } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { ProgressRing } from './ProgressRing';
import { colors, radius, spacing } from '@/lib/theme';

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

export function StatRingTile({ label, owned, total, color = colors.primary, size = 64, icon, hideCaption, onPress }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${label} : ${pct}%, ${owned}/${total}`}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <ProgressRing
        pct={pct} size={size} strokeWidth={Math.max(5, Math.round(size * 0.13))} color={color}
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

const styles = StyleSheet.create({
  tile: { width: 92, alignItems: 'center', gap: 4, padding: spacing.xs, borderRadius: radius.md },
  tilePressed: { backgroundColor: colors.surfaceAlt },
  label: { fontSize: 11, color: colors.text, fontWeight: '600', textAlign: 'center' },
  count: { fontSize: 10, color: colors.textMuted },
});
