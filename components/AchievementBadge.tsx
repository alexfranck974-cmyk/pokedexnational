import { Pressable, Text, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/lib/badges';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  icon: IoniconName;
  iconUri?: string;
  label: string;
  unlocked: boolean;
  onPress?: () => void;
}

export function AchievementBadge({ icon, iconUri, label, unlocked, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    tile: {
      width: 92, alignItems: 'center' as const, gap: 6, padding: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, opacity: 0.5,
    },
    tileUnlocked: { opacity: 1, ...shadow.sm },
    tilePressed: { backgroundColor: colors.surfaceAlt },
    iconWrap: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    iconWrapUnlocked: { backgroundColor: colors.primarySoft },
    iconImg: { width: 26, height: 26, opacity: unlocked ? 1 : 0.4 },
    label: { fontSize: 11, textAlign: 'center' as const, fontFamily: fonts.body },
    labelLocked: { color: colors.textDim },
    labelUnlocked: { color: colors.text, fontFamily: fonts.bodyBold },
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, unlocked && styles.tileUnlocked, pressed && styles.tilePressed]}>
      <View style={[styles.iconWrap, unlocked && styles.iconWrapUnlocked]}>
        {iconUri ? (
          <Image source={{ uri: iconUri }} style={styles.iconImg} resizeMode="contain" />
        ) : (
          <Ionicons name={icon} size={22} color={unlocked ? colors.primary : colors.textDim} />
        )}
      </View>
      <Text style={[styles.label, unlocked ? styles.labelUnlocked : styles.labelLocked]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}
