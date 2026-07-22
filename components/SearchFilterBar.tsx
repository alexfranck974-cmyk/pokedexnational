import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, FlatList, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PokemonType } from '@/lib/types';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { TYPE_LABEL_FR } from '@/lib/types-colors';
import { GENERATIONS } from '@/lib/generations';
import { useTheme, useThemedStyles, type ColorTokens, type ShadowTokens, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  search: string;                       onSearch: (v: string) => void;
  statusFilter: StatusFilter;           onStatus: (v: StatusFilter) => void;
  typeFilter: PokemonType | null;       onType: (v: PokemonType | null) => void;
  setFilter: string | null;             onSet: (v: string | null) => void;
  rarityFilter: string | null;          onRarity: (v: string | null) => void;
  generationFilter: number | null;      onGeneration: (v: number | null) => void;
  sort: SortKey;                        onSort: (v: SortKey) => void;
  sets: { id: string; name: string }[];
  rarities: string[];
  onReset: () => void;
  columns: 2 | 3 | 4 | null;            onColumns: (v: 2 | 3 | 4 | null) => void;
}

const COLUMN_CYCLE: (2 | 3 | 4 | null)[] = [null, 2, 3, 4];

function makeStyles(colors: ColorTokens, shadow: ShadowTokens) {
  return {
    overlay: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, padding: spacing.lg, gap: spacing.md },

    floatingSearch: { alignSelf: 'stretch' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadow.md },
    floatingSearchInput: { flex: 1, fontSize: 15, fontFamily: fonts.body, color: colors.text, padding: 0 },

    fabStack: { gap: spacing.md, alignItems: 'center' as const },
    fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, ...shadow.md },
    badgeDot: { position: 'absolute' as const, top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
    columnsLabel: { fontSize: 15, fontFamily: fonts.monoBold, color: colors.text },

    filterSheetBody: { padding: spacing.md, gap: spacing.sm },
    sectionLabel: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, textTransform: 'uppercase' as const, marginTop: spacing.sm },
    chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, alignItems: 'center' as const },
    chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    chipTextActive: { color: 'white', fontFamily: fonts.bodyBold },
    reset: { alignSelf: 'flex-start' as const, padding: 4, marginTop: spacing.sm },
    resetText: { fontSize: 12, fontFamily: fonts.body, color: colors.danger },

    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '75%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 400, height: 560, borderRadius: radius.xl, marginBottom: 40 },
    sheetHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    sheetTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, height: 44 },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.text },
    check: { color: colors.success, fontSize: 16, fontWeight: '700' as const },
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

interface PickerOption { id: string; label: string; }

function PickerModal({
  visible, title, options, selectedId, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={[{ id: '__all__', label: 'Tous' }, ...options]}
            keyExtractor={i => i.id}
            renderItem={({ item }) => {
              const isSelected =
                (item.id === '__all__' && selectedId === null) ||
                item.id === selectedId;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.id === '__all__' ? null : item.id);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {isSelected && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SearchFilterBar(p: Props) {
  const [openPicker, setOpenPicker] = useState<null | 'type' | 'set' | 'rarity' | 'gen'>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const hasFilters = p.statusFilter !== 'all' || p.typeFilter || p.setFilter || p.rarityFilter || p.generationFilter !== null;

  const typeOptions: PickerOption[] = (Object.keys(TYPE_LABEL_FR) as PokemonType[])
    .map(t => ({ id: t, label: TYPE_LABEL_FR[t] }));
  const setOptions: PickerOption[]  = p.sets.map(s => ({ id: s.id, label: s.name }));
  const rarityOptions: PickerOption[] = p.rarities.map(r => ({ id: r, label: r }));
  const genOptions: PickerOption[] = GENERATIONS.map(g => ({ id: String(g.gen), label: g.label }));

  const typeChipLabel   = p.typeFilter   ? `Type: ${TYPE_LABEL_FR[p.typeFilter]}` : 'Type';
  const setChipLabel    = p.setFilter    ? `Set: ${p.sets.find(s => s.id === p.setFilter)?.name ?? p.setFilter}` : 'Set';
  const rarityChipLabel = p.rarityFilter ? `Rareté: ${p.rarityFilter}` : 'Rareté';
  const genChipLabel    = p.generationFilter ? `Gen ${p.generationFilter}` : 'Génération';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {searchOpen && (
        <View style={styles.floatingSearch}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Rechercher (nom ou n°)"
            value={p.search}
            onChangeText={p.onSearch}
            style={styles.floatingSearchInput}
            autoCapitalize="none"
            autoFocus
            onBlur={() => { if (!p.search) setSearchOpen(false); }}
          />
          <Pressable onPress={() => { p.onSearch(''); setSearchOpen(false); }} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      <View style={styles.fabStack}>
        <Pressable onPress={() => setSearchOpen(o => !o)} style={styles.fab}>
          <Ionicons name="search" size={22} color={p.search ? colors.primary : colors.text} />
        </Pressable>
        <Pressable onPress={() => setFilterSheetOpen(true)} style={styles.fab}>
          <Ionicons name="filter" size={22} color={hasFilters ? colors.primary : colors.text} />
          {hasFilters && <View style={styles.badgeDot} />}
        </Pressable>
        <Pressable
          onPress={() => {
            const idx = COLUMN_CYCLE.indexOf(p.columns);
            p.onColumns(COLUMN_CYCLE[(idx + 1) % COLUMN_CYCLE.length]);
          }}
          style={styles.fab}>
          {p.columns === null ? (
            <Ionicons name="grid-outline" size={22} color={colors.text} />
          ) : (
            <Text style={styles.columnsLabel}>×{p.columns}</Text>
          )}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip label="Tous"      active={p.statusFilter === 'all'}     onPress={() => p.onStatus('all')} />
                <Chip label="Possédés"  active={p.statusFilter === 'owned'}   onPress={() => p.onStatus('owned')} />
                <Chip label="Manquants" active={p.statusFilter === 'missing'} onPress={() => p.onStatus('missing')} />
              </ScrollView>

              <Text style={styles.sectionLabel}>Génération / Type / Set / Rareté</Text>
              <View style={styles.chipRow}>
                <Chip label={genChipLabel}    active={p.generationFilter !== null} onPress={() => setOpenPicker('gen')} />
                <Chip label={typeChipLabel}   active={p.typeFilter !== null}   onPress={() => setOpenPicker('type')} />
                <Chip label={setChipLabel}    active={p.setFilter !== null}    onPress={() => setOpenPicker('set')} />
                <Chip label={rarityChipLabel} active={p.rarityFilter !== null} onPress={() => setOpenPicker('rarity')} />
              </View>

              <Text style={styles.sectionLabel}>Tri</Text>
              <View style={styles.chipRow}>
                <Chip label="N° ↑"   active={p.sort === 'num-asc'}   onPress={() => p.onSort('num-asc')} />
                <Chip label="N° ↓"   active={p.sort === 'num-desc'}  onPress={() => p.onSort('num-desc')} />
                <Chip label="A → Z"  active={p.sort === 'name-asc'}  onPress={() => p.onSort('name-asc')} />
                <Chip label="Z → A"  active={p.sort === 'name-desc'} onPress={() => p.onSort('name-desc')} />
              </View>

              {hasFilters && (
                <Pressable onPress={p.onReset} style={styles.reset}>
                  <Text style={styles.resetText}>Réinitialiser les filtres</Text>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <PickerModal
        visible={openPicker === 'type'}
        title="Type"
        options={typeOptions}
        selectedId={p.typeFilter}
        onSelect={(id) => p.onType(id as PokemonType | null)}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'set'}
        title="Set TCG"
        options={setOptions}
        selectedId={p.setFilter}
        onSelect={p.onSet}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'rarity'}
        title="Rareté"
        options={rarityOptions}
        selectedId={p.rarityFilter}
        onSelect={p.onRarity}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'gen'}
        title="Génération"
        options={genOptions}
        selectedId={p.generationFilter !== null ? String(p.generationFilter) : null}
        onSelect={(id) => p.onGeneration(id === null ? null : parseInt(id, 10))}
        onClose={() => setOpenPicker(null)}
      />
    </View>
  );
}
