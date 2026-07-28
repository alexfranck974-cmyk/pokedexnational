import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import type { ComputedBadge } from '@/lib/badges';
import { AchievementBadge } from './AchievementBadge';
import { BadgeDetailModal, type BadgeDetailTarget } from './BadgeDetailModal';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  visible: boolean;
  badges: ComputedBadge[];
  onClose: () => void;
}

export function AllBadgesModal({ visible, badges, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [badgeDetail, setBadgeDetail] = useState<BadgeDetailTarget | null>(null);
  useModalBackClose(visible, onClose);

  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, maxHeight: 680, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    title: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    body: { padding: spacing.md, flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Tous les badges ({badges.length})</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {badges.map(b => (
              <AchievementBadge
                key={b.id}
                icon={b.icon}
                iconUri={b.iconUri}
                label={b.label}
                unlocked={b.unlockedNow}
                onPress={() => setBadgeDetail({ icon: b.icon, iconUri: b.iconUri, label: b.label, description: b.description, unlocked: b.unlockedNow })}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
      <BadgeDetailModal target={badgeDetail} onClose={() => setBadgeDetail(null)} />
    </Modal>
  );
}
