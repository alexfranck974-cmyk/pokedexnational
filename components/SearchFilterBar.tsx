import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, FlatList, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PokemonType } from '@/lib/types';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { TYPE_LABEL_FR, getTypeLabel } from '@/lib/types-colors';
import { GENERATIONS, getGenerationLabel } from '@/lib/generations';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { useLocale, useT } from '@/lib/locale';
import { useTheme, useThemedStyles, type ColorTokens, type ShadowTokens, radius, spacing, fonts, SCREEN_FAB_CLEARANCE } from '@/lib/theme';

interface Props {
  search: string;                       onSearch: (v: string) => void;
  statusFilter: StatusFilter;           onStatus: (v: StatusFilter) => void;
  typeFilter: PokemonType[];            onType: (v: PokemonType[]) => void;
  setFilter: string | null;             onSet: (v: string | null) => void;
  rarityFilter: string | null;          onRarity: (v: string | null) => void;
  generationFilter: number[];           onGeneration: (v: number[]) => void;
  sort: SortKey;                        onSort: (v: SortKey) => void;
  sets: { id: string; name: string; region?: string }[];
  rarities: string[];
  onReset: () => void;
  columns: 2 | 3 | 4 | null;            onColumns: (v: 2 | 3 | 4 | null) => void;
  /** Clearance above the floating tab bar + Settings FAB (app/(app)/_layout.tsx). Screens without that chrome (e.g. the public profile) pass spacing.lg instead. */
  bottomInset?: number;
  /** Optional 4th FAB toggling a per-card €-value overlay — omit to keep the
   * 3-button stack (e.g. Wishlist, which doesn't wire this yet). */
  showValues?: boolean;                 onToggleValues?: () => void;
  /** Binder-style paged view toggle (Pokédex national only). When in page
   * mode, the columns-cycle FAB is repurposed to cycle the page layout
   * (9/12/16) instead of scroll-mode column overrides — same slot, different
   * meaning, avoids growing the FAB stack further. Omit to keep scroll-only. */
  viewMode?: 'scroll' | 'page';         onToggleViewMode?: () => void;
  pageLayout?: 9 | 12 | 16;             onCyclePageLayout?: () => void;
}

const COLUMN_CYCLE: (2 | 3 | 4 | null)[] = [null, 2, 3, 4];

function makeStyles(colors: ColorTokens, shadow: ShadowTokens, bottomInset: number = SCREEN_FAB_CLEARANCE) {
  return {
    overlay: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, paddingHorizontal: spacing.lg, paddingBottom: bottomInset, gap: spacing.md },

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
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={[{ id: '__all__', label: t('common.all') }, ...options]}
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

function MultiPickerModal({
  visible, title, options, selectedIds, onToggle, onClear, onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={i => i.id}
            ListHeaderComponent={
              <Pressable
                onPress={onClear}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={styles.rowLabel}>{t('common.all')}</Text>
                {selectedIds.length === 0 && <Text style={styles.check}>✓</Text>}
              </Pressable>
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => onToggle(item.id)}
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
  const { locale } = useLocale();
  const t = useT();
  const styles = useThemedStyles((colors, shadow) => makeStyles(colors, shadow, p.bottomInset));
  const hasFilters = p.statusFilter !== 'all' || p.typeFilter.length > 0 || p.setFilter || p.rarityFilter || p.generationFilter.length > 0;

  const typeOptions: PickerOption[] = (Object.keys(TYPE_LABEL_FR) as PokemonType[])
    .map(ty => ({ id: ty, label: getTypeLabel(ty, locale) }));
  const setOptions: PickerOption[]  = p.sets.map(s => ({ id: s.id, label: setFlagLabel(s.name, s.region) }));
  const rarityOptions: PickerOption[] = p.rarities.map(r => ({ id: r, label: r }));
  const genOptions: PickerOption[] = GENERATIONS.map(g => ({ id: String(g.gen), label: getGenerationLabel(g, locale) }));

  const typeChipLabel =
    p.typeFilter.length === 0 ? t('search.typeLabel')
    : p.typeFilter.length === 1 ? t('search.typeChip', { value: getTypeLabel(p.typeFilter[0], locale) })
    : t('search.typeChipCount', { n: p.typeFilter.length });
  const setChipLabel    = p.setFilter    ? t('search.setChip', { value: setOptions.find(s => s.id === p.setFilter)?.label ?? p.setFilter }) : t('search.setLabel');
  const rarityChipLabel = p.rarityFilter ? t('search.rarityChip', { value: p.rarityFilter }) : t('search.rarityLabel');
  const genChipLabel =
    p.generationFilter.length === 0 ? t('search.generationLabel')
    : p.generationFilter.length === 1 ? `Gen ${p.generationFilter[0]}`
    : t('search.genChipCount', { n: p.generationFilter.length });

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {searchOpen && (
        <View style={styles.floatingSearch}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder={t('search.placeholder')}
            value={p.search}
            onChangeText={p.onSearch}
            style={styles.floatingSearchInput}
            autoCapitalize="none"
            autoFocus
            onBlur={() => { if (!p.search) setSearchOpen(false); }}
          />
          <Pressable onPress={() => { p.onSearch(''); setSearchOpen(false); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('search.a11yClear')}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      <View style={styles.fabStack}>
        <Pressable onPress={() => setSearchOpen(o => !o)} style={styles.fab} accessibilityRole="button" accessibilityLabel={t('search.a11yToggleSearch')}>
          <Ionicons name="search" size={22} color={p.search ? colors.primary : colors.text} />
        </Pressable>
        <Pressable onPress={() => setFilterSheetOpen(true)} style={styles.fab} accessibilityRole="button" accessibilityLabel={t('search.a11yToggleFilter')}>
          <Ionicons name="filter" size={22} color={hasFilters ? colors.primary : colors.text} />
          {hasFilters && <View style={styles.badgeDot} />}
        </Pressable>
        <Pressable
          onPress={() => {
            if (p.viewMode === 'page') { p.onCyclePageLayout?.(); return; }
            const idx = COLUMN_CYCLE.indexOf(p.columns);
            p.onColumns(COLUMN_CYCLE[(idx + 1) % COLUMN_CYCLE.length]);
          }}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t(p.viewMode === 'page' ? 'search.a11yCyclePageLayout' : 'search.a11yCycleColumns')}>
          {p.viewMode === 'page' ? (
            <Text style={styles.columnsLabel}>×{p.pageLayout}</Text>
          ) : p.columns === null ? (
            <Ionicons name="grid-outline" size={22} color={colors.text} />
          ) : (
            <Text style={styles.columnsLabel}>×{p.columns}</Text>
          )}
        </Pressable>
        {p.onToggleValues && (
          <Pressable onPress={p.onToggleValues} style={styles.fab} accessibilityRole="button" accessibilityLabel={t('search.a11yTogglePrice')}>
            <Ionicons name="pricetag" size={20} color={p.showValues ? colors.primary : colors.text} />
          </Pressable>
        )}
        {p.onToggleViewMode && (
          <Pressable onPress={p.onToggleViewMode} style={styles.fab} accessibilityRole="button" accessibilityLabel={t('search.a11yToggleViewMode')}>
            <Ionicons name={p.viewMode === 'page' ? 'book' : 'book-outline'} size={20} color={p.viewMode === 'page' ? colors.primary : colors.text} />
          </Pressable>
        )}
      </View>

      <Modal visible={filterSheetOpen} transparent animationType="slide" onRequestClose={() => setFilterSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterSheetOpen(false)}>
          <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('search.filtersTitle')}</Text>
              <Pressable onPress={() => setFilterSheetOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.filterSheetBody}>
              <Text style={styles.sectionLabel}>{t('search.statusLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip label={t('common.all')}      active={p.statusFilter === 'all'}     onPress={() => p.onStatus('all')} />
                <Chip label={t('search.owned')}     active={p.statusFilter === 'owned'}   onPress={() => p.onStatus('owned')} />
                <Chip label={t('search.missing')}   active={p.statusFilter === 'missing'} onPress={() => p.onStatus('missing')} />
              </ScrollView>

              <Text style={styles.sectionLabel}>{t('search.sectionLabel')}</Text>
              <View style={styles.chipRow}>
                <Chip label={genChipLabel}    active={p.generationFilter.length > 0} onPress={() => setOpenPicker('gen')} />
                <Chip label={typeChipLabel}   active={p.typeFilter.length > 0}   onPress={() => setOpenPicker('type')} />
                <Chip label={setChipLabel}    active={p.setFilter !== null}    onPress={() => setOpenPicker('set')} />
                <Chip label={rarityChipLabel} active={p.rarityFilter !== null} onPress={() => setOpenPicker('rarity')} />
              </View>

              <Text style={styles.sectionLabel}>{t('search.sortLabel')}</Text>
              <View style={styles.chipRow}>
                <Chip label="N° ↑"   active={p.sort === 'num-asc'}   onPress={() => p.onSort('num-asc')} />
                <Chip label="N° ↓"   active={p.sort === 'num-desc'}  onPress={() => p.onSort('num-desc')} />
                <Chip label="A → Z"  active={p.sort === 'name-asc'}  onPress={() => p.onSort('name-asc')} />
                <Chip label="Z → A"  active={p.sort === 'name-desc'} onPress={() => p.onSort('name-desc')} />
              </View>

              {hasFilters && (
                <Pressable onPress={p.onReset} style={styles.reset}>
                  <Text style={styles.resetText}>{t('search.resetFilters')}</Text>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <MultiPickerModal
        visible={openPicker === 'type'}
        title={t('search.typeLabel')}
        options={typeOptions}
        selectedIds={p.typeFilter}
        onToggle={(id) => {
          const t = id as PokemonType;
          p.onType(p.typeFilter.includes(t) ? p.typeFilter.filter(x => x !== t) : [...p.typeFilter, t]);
        }}
        onClear={() => p.onType([])}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'set'}
        title={t('search.setTcgTitle')}
        options={setOptions}
        selectedId={p.setFilter}
        onSelect={p.onSet}
        onClose={() => setOpenPicker(null)}
      />
      <PickerModal
        visible={openPicker === 'rarity'}
        title={t('search.rarityLabel')}
        options={rarityOptions}
        selectedId={p.rarityFilter}
        onSelect={p.onRarity}
        onClose={() => setOpenPicker(null)}
      />
      <MultiPickerModal
        visible={openPicker === 'gen'}
        title={t('search.generationLabel')}
        options={genOptions}
        selectedIds={p.generationFilter.map(String)}
        onToggle={(id) => {
          const g = parseInt(id, 10);
          p.onGeneration(p.generationFilter.includes(g) ? p.generationFilter.filter(x => x !== g) : [...p.generationFilter, g]);
        }}
        onClear={() => p.onGeneration([])}
        onClose={() => setOpenPicker(null)}
      />
    </View>
  );
}
