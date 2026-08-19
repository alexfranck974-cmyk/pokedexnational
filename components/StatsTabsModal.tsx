import type { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import type { StringKey } from '@/lib/strings';

export type StatsTab = 'progress' | 'generation' | 'type' | 'variants' | 'artists';

const TAB_KEYS: { key: StatsTab; labelKey: StringKey }[] = [
  { key: 'progress', labelKey: 'statsTabs.progress' },
  { key: 'generation', labelKey: 'statsTabs.generation' },
  { key: 'type', labelKey: 'statsTabs.type' },
  { key: 'variants', labelKey: 'statsTabs.variants' },
  { key: 'artists', labelKey: 'statsTabs.artists' },
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
  const t = useT();
  const styles = useThemedStyles((colors) => ({
    tabRow: { gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.sm },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    tabTextActive: { color: 'white' },
    body: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  }));

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={tint} title={t('statsTabs.title')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TAB_KEYS.map(tk => (
          <Pressable
            key={tk.key}
            onPress={() => onTabChange(tk.key)}
            style={[styles.tab, tab === tk.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === tk.key && styles.tabTextActive]}>{t(tk.labelKey)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.body}>
        {children}
      </ScrollView>
    </BubbleSheet>
  );
}
