import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/lib/badges';
import { BubbleSheet } from './BubbleSheet';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useT } from '@/lib/locale';

export interface BadgeDetailTarget {
  icon: IoniconName;
  iconUri?: string;
  label: string;
  description: string;
  unlocked: boolean;
}

interface Props {
  target: BadgeDetailTarget | null;
  tint: string;
  onClose: () => void;
}

export function BadgeDetailModal({ target, tint, onClose }: Props) {
  const { colors } = useTheme();
  const t = useT();
  useModalBackClose(target !== null, onClose);
  const styles = useThemedStyles((colors) => ({
    body: { padding: spacing.xl, alignItems: 'center' as const, gap: spacing.sm },
    iconWrap: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt,
      alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: spacing.xs,
    },
    iconWrapUnlocked: { backgroundColor: colors.primarySoft },
    iconImg: { width: 38, height: 38 },
    label: { fontSize: 17, fontFamily: fonts.display, color: colors.text, textAlign: 'center' as const },
    statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
    statusUnlocked: { backgroundColor: colors.successBg },
    statusLocked: { backgroundColor: colors.surfaceAlt },
    statusText: { fontSize: 11, fontFamily: fonts.bodyBold },
    statusTextUnlocked: { color: colors.success },
    statusTextLocked: { color: colors.textMuted },
    description: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const, marginTop: spacing.xs },
    closeBtn: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.md, alignSelf: 'stretch' as const, alignItems: 'center' as const },
    closeBtnText: { color: 'white', fontFamily: fonts.bodyBold },
  }));

  return (
    <BubbleSheet visible={target !== null} onClose={onClose} tint={tint} sizing="auto">
      {target && (
        <View style={styles.body}>
          <View style={[styles.iconWrap, target.unlocked && styles.iconWrapUnlocked]}>
            {target.iconUri ? (
              <Image source={{ uri: target.iconUri }} style={[styles.iconImg, { opacity: target.unlocked ? 1 : 0.4 }]} resizeMode="contain" />
            ) : (
              <Ionicons name={target.icon} size={32} color={target.unlocked ? colors.primary : colors.textDim} />
            )}
          </View>
          <Text style={styles.label}>{target.label}</Text>
          <View style={[styles.statusPill, target.unlocked ? styles.statusUnlocked : styles.statusLocked]}>
            <Text style={[styles.statusText, target.unlocked ? styles.statusTextUnlocked : styles.statusTextLocked]}>
              {target.unlocked ? t('badgeDetail.unlocked') : t('badgeDetail.locked')}
            </Text>
          </View>
          <Text style={styles.description}>{target.description}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>{t('badgeDetail.close')}</Text>
          </Pressable>
        </View>
      )}
    </BubbleSheet>
  );
}
