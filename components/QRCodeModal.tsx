import { Modal, View, Text, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { toast } from '@/lib/toast';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  visible: boolean;
  value: string;
  label: string;
  onClose: () => void;
}

export function QRCodeModal({ visible, value, label, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center' as const, justifyContent: 'center' as const, padding: spacing.xl },
    card: {
      backgroundColor: 'white', borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' as const, gap: spacing.md, ...shadow.md,
      width: '100%' as const, maxWidth: 320,
    },
    title: { fontSize: 16, fontFamily: fonts.display, color: '#171717' },
    hint: { fontSize: 12, fontFamily: fonts.body, color: '#6d5c53', textAlign: 'center' as const, maxWidth: 220 },
    close: {
      position: 'absolute' as const, top: spacing.md, right: spacing.md,
      backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 6,
    },
    divider: { width: '100%' as const, height: 1, backgroundColor: '#e6d8cd' },
    linkRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: '#f0e6df', borderRadius: radius.md, padding: spacing.sm, alignSelf: 'stretch' as const,
    },
    linkText: { flex: 1, minWidth: 0, fontSize: 12, fontFamily: fonts.mono, color: '#211613' },
    copyBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
      backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6,
    },
    copyBtnText: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white' },
  }));

  const copy = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    toast('Lien copié !');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{label}</Text>
          <QRCode value={value} size={200} backgroundColor="white" color="#171717" />
          <Text style={styles.hint}>Scanne avec l'appareil photo de ton téléphone, ou partage le lien directement.</Text>
          <View style={styles.divider} />
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>{value}</Text>
            <Pressable onPress={copy} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={13} color="white" />
              <Text style={styles.copyBtnText}>Copier</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
