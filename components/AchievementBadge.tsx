import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/lib/badges';
import { colors, radius, spacing, shadow } from '@/lib/theme';

interface Props {
  icon: IoniconName;
  label: string;
  unlocked: boolean;
  onPress?: () => void;
}

export function AchievementBadge({ icon, label, unlocked, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, unlocked && styles.tileUnlocked, pressed && styles.tilePressed]}>
      <View style={[styles.iconWrap, unlocked && styles.iconWrapUnlocked]}>
        <Ionicons name={icon} size={22} color={unlocked ? colors.primary : colors.textDim} />
      </View>
      <Text style={[styles.label, unlocked ? styles.labelUnlocked : styles.labelLocked]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 92, alignItems: 'center', gap: 6, padding: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, opacity: 0.5,
  },
  tileUnlocked: { opacity: 1, ...shadow.sm },
  tilePressed: { backgroundColor: colors.surfaceAlt },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapUnlocked: { backgroundColor: colors.primaryBg },
  label: { fontSize: 11, textAlign: 'center' },
  labelLocked: { color: colors.textDim },
  labelUnlocked: { color: colors.text, fontWeight: '600' },
});
