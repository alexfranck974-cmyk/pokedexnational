import { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTcgSets, type TcgSetInfo } from '@/lib/tcg-index';
import { useToggleSetGoal } from '@/lib/collection-goals';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Props {
  visible: boolean;
  pinnedSetIds: Set<string>;
  onClose: () => void;
}

export function SetGoalPicker({ visible, pinnedSetIds, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [search, setSearch] = useState('');
  const { data: sets = [] } = useTcgSets();
  const toggleGoal = useToggleSetGoal();

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return sets;
    return sets.filter(s => normalize(s.name).includes(q));
  }, [sets, search]);

  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, height: 640, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    search: { margin: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: spacing.xl, fontStyle: 'italic' as const },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: 16, height: 60 },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    rowCaption: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim, marginTop: 2 },
    pinBadge: {
      width: 26, height: 26, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    pinBadgeActive: { backgroundColor: colors.success, borderColor: colors.success },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>Objectifs de complétion</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            placeholder="Chercher une extension"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            style={styles.search}
          />
          {filtered.length === 0 ? (
            <Text style={styles.empty}>Aucune extension trouvée.</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(s: TcgSetInfo) => s.id}
              renderItem={({ item }) => {
                const pinned = pinnedSetIds.has(item.id);
                const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null;
                return (
                  <Pressable
                    onPress={() => toggleGoal.mutate({ setId: item.id, currentlyPinned: pinned })}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowCaption}>
                        {year ? `${year} · ` : ''}{item.cardCount} cartes
                      </Text>
                    </View>
                    <View style={[styles.pinBadge, pinned && styles.pinBadgeActive]}>
                      {pinned && <Ionicons name="checkmark" size={16} color="white" />}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
