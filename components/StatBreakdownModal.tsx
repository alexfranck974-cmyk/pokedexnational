import { useState } from 'react';
import { View, Text, Image, Pressable, Modal, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing } from './ProgressRing';
import { CardZoomModal, type ZoomableCard } from './CardZoomModal';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export interface BreakdownItem {
  key: string;
  dexNum: number;
  image: string;
  imageLarge?: string | null;
  label: string;
  owned: boolean;
}

export interface BreakdownTarget {
  title: string;
  owned: number;
  total: number;
  color: string;
  items: BreakdownItem[];
  ringless?: boolean;
}

interface Props {
  target: BreakdownTarget | null;
  onClose: () => void;
  onSelectItem: (dexNum: number) => void;
}

export function StatBreakdownModal({ target, onClose, onSelectItem }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const pct = target && target.total > 0 ? Math.round((target.owned / target.total) * 100) : 0;
  const [zoomCard, setZoomCard] = useState<ZoomableCard | null>(null);
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '80%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 420, maxHeight: 640, borderRadius: radius.xl, marginBottom: 40 },
    sheetHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    sheetTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    body: { padding: spacing.lg, alignItems: 'center' as const, gap: spacing.md },
    legend: { alignSelf: 'stretch' as const, gap: spacing.sm },
    legendRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    dot: { width: 12, height: 12, borderRadius: 6 },
    legendLabel: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: colors.text },
    legendValue: { fontSize: 14, fontFamily: fonts.monoBold, color: colors.text },

    list: { paddingHorizontal: spacing.md },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingVertical: spacing.sm },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowImage: { width: 32, height: 32 },
    rowLabel: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: colors.text },
  }));

  const handlePress = (item: BreakdownItem) => {
    if (item.owned) {
      setZoomCard({ image_small: item.image, image_large: item.imageLarge });
    } else {
      onSelectItem(item.dexNum);
      onClose();
    }
  };

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          {target && (
            <>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{target.title}</Text>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>

              {!target.ringless && (
                <View style={styles.body}>
                  <ProgressRing
                    pct={pct} size={120} strokeWidth={14} color={target.color}
                    centerLabel={`${pct}%`} centerSub={`${target.owned}/${target.total}`}
                  />
                  <View style={styles.legend}>
                    <View style={styles.legendRow}>
                      <View style={[styles.dot, { backgroundColor: target.color }]} />
                      <Text style={styles.legendLabel}>Possédés</Text>
                      <Text style={styles.legendValue}>{target.owned}</Text>
                    </View>
                    <View style={styles.legendRow}>
                      <View style={[styles.dot, { backgroundColor: colors.surfaceAlt }]} />
                      <Text style={styles.legendLabel}>Manquants</Text>
                      <Text style={styles.legendValue}>{target.total - target.owned}</Text>
                    </View>
                  </View>
                </View>
              )}

              <FlatList
                data={target.items}
                keyExtractor={item => item.key}
                style={styles.list}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handlePress(item)}
                    onLongPress={item.owned ? () => handlePress(item) : undefined}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <Image source={{ uri: item.image }} style={styles.rowImage} resizeMode="contain" />
                    <Text style={styles.rowLabel} numberOfLines={1}>{item.label}</Text>
                    <Ionicons
                      name={item.owned ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={item.owned ? colors.success : colors.textDim}
                    />
                  </Pressable>
                )}
              />
            </>
          )}
        </Pressable>
      </Pressable>
      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
    </Modal>
  );
}
