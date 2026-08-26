import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BubbleSheet } from './BubbleSheet';
import { RING_KEYS, type RingKey, type DashboardRingLayout, useUpdateDashboardRingLayout } from '@/lib/dashboard-layout';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import type { StringKey } from '@/lib/strings';

interface Props {
  visible: boolean;
  layout: DashboardRingLayout;
  onClose: () => void;
}

const RING_LABEL_KEY: Record<RingKey, StringKey> = {
  goals: 'dashboard.collectionLabel',
  badges: 'dashboard.badgesLabel',
  trades: 'dashboard.tradesLabel',
  cards: 'dashboard.ownedLabel',
};

// Reorder/show-hide sheet for the Dashboard's 4 ring widgets — up/down
// buttons rather than drag-and-drop, deliberately: only 4 rows, so a full
// gesture-based reorder would add real risk (drop-position math, scroll
// interaction) for no real gain over two taps.
export function DashboardLayoutSheet({ visible, layout, onClose }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const update = useUpdateDashboardRingLayout();

  const move = (key: RingKey, dir: -1 | 1) => {
    const i = layout.order.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= layout.order.length) return;
    const nextOrder = [...layout.order];
    [nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]];
    update.mutate({ order: nextOrder, hidden: layout.hidden });
  };

  const toggleHidden = (key: RingKey) => {
    const nextHidden = new Set(layout.hidden);
    if (nextHidden.has(key)) nextHidden.delete(key); else nextHidden.add(key);
    update.mutate({ order: layout.order, hidden: nextHidden });
  };

  const reset = () => update.mutate({ order: RING_KEYS, hidden: new Set() });

  const styles = useThemedStyles((colors) => ({
    body: { padding: spacing.md, gap: spacing.sm },
    hint: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginBottom: spacing.xs },
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    },
    rowHidden: { opacity: 0.5 },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    moveBtn: { padding: 6 },
    moveBtnDisabled: { opacity: 0.25 },
    visBtn: { padding: 6 },
    resetBtn: { alignSelf: 'flex-end' as const, padding: spacing.sm },
    resetBtnText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.primary },
  }));

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={colors.primary} title={t('dashboard.layoutSheetTitle')} sizing="auto">
      <View style={styles.body}>
        <Text style={styles.hint}>{t('dashboard.layoutSheetHint')}</Text>
        {layout.order.map((key, i) => {
          const hidden = layout.hidden.has(key);
          return (
            <View key={key} style={[styles.row, hidden && styles.rowHidden]}>
              <Pressable
                onPress={() => move(key, -1)}
                disabled={i === 0}
                hitSlop={8}
                accessibilityLabel={t('dashboard.a11yMoveUp')}
                style={[styles.moveBtn, i === 0 && styles.moveBtnDisabled]}>
                <Ionicons name="chevron-up" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => move(key, 1)}
                disabled={i === layout.order.length - 1}
                hitSlop={8}
                accessibilityLabel={t('dashboard.a11yMoveDown')}
                style={[styles.moveBtn, i === layout.order.length - 1 && styles.moveBtnDisabled]}>
                <Ionicons name="chevron-down" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.rowLabel}>{t(RING_LABEL_KEY[key])}</Text>
              <Pressable
                onPress={() => toggleHidden(key)}
                hitSlop={8}
                accessibilityLabel={t('dashboard.a11yToggleVisible')}
                style={styles.visBtn}>
                <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={hidden ? colors.textDim : colors.primary} />
              </Pressable>
            </View>
          );
        })}
        <Pressable onPress={reset} hitSlop={8} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>{t('dashboard.layoutSheetReset')}</Text>
        </Pressable>
      </View>
    </BubbleSheet>
  );
}
