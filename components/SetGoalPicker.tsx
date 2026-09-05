import { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTcgSets, type TcgSetInfo } from '@/lib/tcg-index';
import { useToggleSetGoal } from '@/lib/collection-goals';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface Props {
  visible: boolean;
  pinnedSetIds: Set<string>;
  tint: string;
  onClose: () => void;
}

export function SetGoalPicker({ visible, pinnedSetIds, tint, onClose }: Props) {
  const t = useT();
  const [search, setSearch] = useState('');
  const { data: sets = [] } = useTcgSets();
  const toggleGoal = useToggleSetGoal();

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return sets;
    return sets.filter(s => normalize(s.name).includes(q) || normalize(setFlagLabel(s.name, s.region, s.id)).includes(q));
  }, [sets, search]);

  const styles = useThemedStyles((colors) => ({
    search: { margin: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: spacing.xl, fontStyle: 'italic' as const },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: 16, height: 60 },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowIcon: { width: 24, height: 24 },
    rowIconPlaceholder: { width: 24, height: 24 },
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
    <BubbleSheet visible={visible} onClose={onClose} tint={tint} title={t('setGoalPicker.title')} desktopFixedHeight={640}>
          <TextInput
            placeholder={t('setGoalPicker.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            style={styles.search}
          />
          {filtered.length === 0 ? (
            <Text style={styles.empty}>{t('setGoalPicker.empty')}</Text>
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
                    {item.symbol ? (
                      <Image source={{ uri: item.symbol }} style={styles.rowIcon} resizeMode="contain" />
                    ) : (
                      <View style={styles.rowIconPlaceholder} />
                    )}
                    <View style={styles.rowText}>
                      <Text style={styles.rowLabel} numberOfLines={1}>{setFlagLabel(item.name, item.region, item.id)}</Text>
                      <Text style={styles.rowCaption}>
                        {year ? `${year} · ` : ''}{t('setGoalPicker.cardsCount', { n: item.cardCount })}
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
    </BubbleSheet>
  );
}
