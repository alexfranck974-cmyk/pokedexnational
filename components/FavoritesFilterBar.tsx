import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FavStatusFilter, FavSortKey } from '@/app/(app)/favorites';
import { useTheme, useThemedStyles, type ColorTokens, type ShadowTokens, radius, spacing, fonts, SCREEN_FAB_CLEARANCE } from '@/lib/theme';

interface Props {
  search: string;                     onSearch: (v: string) => void;
  statusFilter: FavStatusFilter;      onStatus: (v: FavStatusFilter) => void;
  sort: FavSortKey;                   onSort: (v: FavSortKey) => void;
}

// Same collapsed-by-default shell as SearchFilterBar (search FAB expands inline,
// filter FAB opens a bottom sheet) — Favoris previously kept its search box and
// two chip rows permanently on screen, unlike every other tab in the app.
function makeStyles(colors: ColorTokens, shadow: ShadowTokens) {
  return {
    overlay: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, paddingHorizontal: spacing.lg, paddingBottom: SCREEN_FAB_CLEARANCE, gap: spacing.md },

    floatingSearch: { alignSelf: 'stretch' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadow.md },
    floatingSearchInput: { flex: 1, fontSize: 15, fontFamily: fonts.body, color: colors.text, padding: 0 },

    fabStack: { gap: spacing.md, alignItems: 'center' as const },
    fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, ...shadow.md },
    badgeDot: { position: 'absolute' as const, top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },

    filterSheetBody: { padding: spacing.md, gap: spacing.sm },
    sectionLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, textTransform: 'uppercase' as const, marginTop: spacing.sm },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, alignItems: 'center' as const },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    chipTextActive: { color: 'white', fontFamily: fonts.bodyBold },

    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '75%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 400, borderRadius: radius.xl, marginBottom: 40 },
    sheetHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    sheetTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
  };
}

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
};

export function FavoritesFilterBar({ search, onSearch, statusFilter, onStatus, sort, onSort }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hasFilters = statusFilter !== 'all' || sort !== 'num-asc';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {searchOpen && (
        <View style={styles.floatingSearch}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Rechercher (nom, n°, artiste)"
            value={search}
            onChangeText={onSearch}
            style={styles.floatingSearchInput}
            autoCapitalize="none"
            autoFocus
            onBlur={() => { if (!search) setSearchOpen(false); }}
          />
          <Pressable onPress={() => { onSearch(''); setSearchOpen(false); }} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      <View style={styles.fabStack}>
        <Pressable onPress={() => setSearchOpen(o => !o)} style={styles.fab}>
          <Ionicons name="search" size={22} color={search ? colors.primary : colors.text} />
        </Pressable>
        <Pressable onPress={() => setFilterSheetOpen(true)} style={styles.fab}>
          <Ionicons name="filter" size={22} color={hasFilters ? colors.primary : colors.text} />
          {hasFilters && <View style={styles.badgeDot} />}
        </Pressable>
      </View>

      <Modal visible={filterSheetOpen} transparent animationType="slide" onRequestClose={() => setFilterSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterSheetOpen(false)}>
          <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filtres</Text>
              <Pressable onPress={() => setFilterSheetOpen(false)} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.filterSheetBody}>
              <Text style={styles.sectionLabel}>Statut</Text>
              <View style={styles.chipRow}>
                <Chip label="Tous" active={statusFilter === 'all'} onPress={() => onStatus('all')} />
                <Chip label="★ Favoris" active={statusFilter === 'favorites'} onPress={() => onStatus('favorites')} />
                <Chip label="✨ Vitrine" active={statusFilter === 'vitrine'} onPress={() => onStatus('vitrine')} />
              </View>

              <Text style={styles.sectionLabel}>Tri</Text>
              <View style={styles.chipRow}>
                <Chip label="★ récent" active={sort === 'fav-recent'} onPress={() => onSort('fav-recent')} />
                <Chip label="N° ↑" active={sort === 'num-asc'} onPress={() => onSort('num-asc')} />
                <Chip label="N° ↓" active={sort === 'num-desc'} onPress={() => onSort('num-desc')} />
                <Chip label="A→Z" active={sort === 'name-asc'} onPress={() => onSort('name-asc')} />
                <Chip label="Z→A" active={sort === 'name-desc'} onPress={() => onSort('name-desc')} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
