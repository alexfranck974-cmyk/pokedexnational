import { useState } from 'react';
import { View, Text, Image, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing } from './ProgressRing';
import { BubbleSheet } from './BubbleSheet';
import { CardZoomModal, type ZoomableCard } from './CardZoomModal';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

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
  const pct = target && target.total > 0 ? Math.round((target.owned / target.total) * 100) : 0;
  const [zoomCard, setZoomCard] = useState<ZoomableCard | null>(null);
  const { colors } = useTheme();
  const t = useT();
  const styles = useThemedStyles((colors, shadow) => ({
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
    <>
      <BubbleSheet visible={target !== null} onClose={onClose} tint={target?.color ?? colors.primary} title={target?.title}>
        {target && (
          <>
            {!target.ringless && (
              <View style={styles.body}>
                <ProgressRing
                  pct={pct} size={120} strokeWidth={14} color={target.color}
                  centerLabel={`${pct}%`} centerSub={`${target.owned}/${target.total}`}
                />
                <View style={styles.legend}>
                  <View style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: target.color }]} />
                    <Text style={styles.legendLabel}>{t('statBreakdown.owned')}</Text>
                    <Text style={styles.legendValue}>{target.owned}</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: colors.surfaceAlt }]} />
                    <Text style={styles.legendLabel}>{t('statBreakdown.missing')}</Text>
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
      </BubbleSheet>
      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
    </>
  );
}
