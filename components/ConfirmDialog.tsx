import { View, Text, Pressable, Modal } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export interface ConfirmTarget {
  title: string;
  message?: string;
}

interface Props {
  target: ConfirmTarget | null;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// React Native Web doesn't reliably support Alert.alert with multiple custom
// buttons, so any destructive confirmation in this app goes through this
// instead of Alert.alert.
export function ConfirmDialog({ target, confirmLabel = 'Supprimer', cancelLabel = 'Annuler', onConfirm, onCancel }: Props) {
  const styles = useThemedStyles((colors, shadow) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center' as const, justifyContent: 'center' as const, padding: spacing.xl },
    card: {
      width: '100%' as const, maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.lg, gap: spacing.sm, ...shadow.md,
    },
    title: { fontSize: 17, fontFamily: fonts.display, color: colors.text },
    message: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted },
    actions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.sm },
    cancelBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    cancelText: { fontFamily: fonts.bodyBold, color: colors.text },
    confirmBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center' as const },
    confirmText: { fontFamily: fonts.bodyBold, color: 'white' },
  }));

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          {target && (
            <>
              <Text style={styles.title}>{target.title}</Text>
              {target.message && <Text style={styles.message}>{target.message}</Text>}
              <View style={styles.actions}>
                <Pressable onPress={onCancel} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>{cancelLabel}</Text>
                </Pressable>
                <Pressable onPress={onConfirm} style={styles.confirmBtn}>
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
