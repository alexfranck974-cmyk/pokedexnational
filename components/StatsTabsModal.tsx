import type { ReactNode } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export type StatsTab = 'generation' | 'type' | 'variants' | 'artists';

const TABS: { key: StatsTab; label: string }[] = [
  { key: 'generation', label: 'Génération' },
  { key: 'type', label: 'Type' },
  { key: 'variants', label: 'Formes' },
  { key: 'artists', label: 'Artistes' },
];

interface Props {
  visible: boolean;
  tab: StatsTab;
  onTabChange: (tab: StatsTab) => void;
  onClose: () => void;
  children: ReactNode;
}

export function StatsTabsModal({ visible, tab, onTabChange, onClose, children }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, maxHeight: 680, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    title: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    tabRow: { gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.sm },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    tabTextActive: { color: 'white' },
    body: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Statistiques</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {TABS.map(t => (
              <Pressable
                key={t.key}
                onPress={() => onTabChange(t.key)}
                style={[styles.tab, tab === t.key && styles.tabActive]}>
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
