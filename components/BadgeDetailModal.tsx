import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/lib/badges';
import { colors, radius, spacing, shadow } from '@/lib/theme';

export interface BadgeDetailTarget {
  icon: IoniconName;
  label: string;
  description: string;
  unlocked: boolean;
}

interface Props {
  target: BadgeDetailTarget | null;
  onClose: () => void;
}

export function BadgeDetailModal({ target, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          {target && (
            <View style={styles.body}>
              <View style={[styles.iconWrap, target.unlocked && styles.iconWrapUnlocked]}>
                <Ionicons name={target.icon} size={32} color={target.unlocked ? colors.primary : colors.textDim} />
              </View>
              <Text style={styles.label}>{target.label}</Text>
              <View style={[styles.statusPill, target.unlocked ? styles.statusUnlocked : styles.statusLocked]}>
                <Text style={[styles.statusText, target.unlocked ? styles.statusTextUnlocked : styles.statusTextLocked]}>
                  {target.unlocked ? 'Débloqué' : 'Verrouillé'}
                </Text>
              </View>
              <Text style={styles.description}>{target.description}</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Fermer</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetDesktop: { width: 400, borderRadius: radius.xl, marginBottom: 40 },
  body: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
  },
  iconWrapUnlocked: { backgroundColor: colors.primaryBg },
  label: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  statusUnlocked: { backgroundColor: colors.successBg },
  statusLocked: { backgroundColor: colors.surfaceAlt },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextUnlocked: { color: colors.success },
  statusTextLocked: { color: colors.textMuted },
  description: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  closeBtn: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.md, alignSelf: 'stretch', alignItems: 'center' },
  closeBtnText: { color: 'white', fontWeight: '700' },
});
