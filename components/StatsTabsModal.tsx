import type { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export type StatsTab = 'progress' | 'generation' | 'type' | 'variants' | 'artists';

const TABS: { key: StatsTab; label: string }[] = [
  { key: 'progress', label: 'Progression' },
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
  tint: string;
  children: ReactNode;
}

export function StatsTabsModal({ visible, tab, onTabChange, onClose, tint, children }: Props) {
  const styles = useThemedStyles((colors) => ({
    tabRow: { gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.sm },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    tabTextActive: { color: 'white' },
    body: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  }));

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={tint} title="Statistiques">
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
    </BubbleSheet>
  );
}
