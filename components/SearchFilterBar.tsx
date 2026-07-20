import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, FlatList, useWindowDimensions } from 'react-native';
import type { PokemonType } from '@/lib/types';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { TYPE_LABEL_FR } from '@/lib/types-colors';
import { colors, radius, spacing } from '@/lib/theme';

interface Props {
  search: string;                       onSearch: (v: string) => void;
  statusFilter: StatusFilter;           onStatus: (v: StatusFilter) => void;
  typeFilter: PokemonType | null;       onType: (v: PokemonType | null) => void;
  setFilter: string | null;             onSet: (v: string | null) => void;
  rarityFilter: string | null;          onRarity: (v: string | null) => void;
  sort: SortKey;                        onSort: (v: SortKey) => void;
  sets: { id: string; name: string }[];
  rarities: string[];
  onReset: () => void;
}

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

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
  const [openPicker, setOpenPicker] = useState<null | 'type' | 'set' | 'rarity'>(null);
  const hasFilters = p.statusFilter !== 'all' || p.typeFilter || p.setFilter || p.rarityFilter;

  const typeOptions: PickerOption[] = (Object.keys(TYPE_LABEL_FR) as PokemonType[])
    .map(t => ({ id: t, label: TYPE_LABEL_FR[t] }));
  const setOptions: PickerOption[]  = p.sets.map(s => ({ id: s.id, label: s.name }));
  const rarityOptions: PickerOption[] = p.rarities.map(r => ({ id: r, label: r }));

  const typeChipLabel   = p.typeFilter   ? `Type: ${TYPE_LABEL_FR[p.typeFilter]}` : 'Type';
  const setChipLabel    = p.setFilter    ? `Set: ${p.sets.find(s => s.id === p.setFilter)?.name ?? p.setFilter}` : 'Set';
  const rarityChipLabel = p.rarityFilter ? `Rareté: ${p.rarityFilter}` : 'Rareté';

  return (
    <View style={styles.wrap}>
      <TextInput placeholder="Rechercher (nom ou n°)" value={p.search} onChangeText={p.onSearch}
        style={styles.search} autoCapitalize="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="Tous"      active={p.statusFilter === 'all'}     onPress={() => p.onStatus('all')} />
        <Chip label="Possédés"  active={p.statusFilter === 'owned'}   onPress={() => p.onStatus('owned')} />
        <Chip label="Manquants" active={p.statusFilter === 'missing'} onPress={() => p.onStatus('missing')} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label={typeChipLabel}   active={p.typeFilter !== null}   onPress={() => setOpenPicker('type')} />
        <Chip label={setChipLabel}    active={p.setFilter !== null}    onPress={() => setOpenPicker('set')} />
        <Chip label={rarityChipLabel} active={p.rarityFilter !== null} onPress={() => setOpenPicker('rarity')} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="N° ↑"   active={p.sort === 'num-asc'}   onPress={() => p.onSort('num-asc')} />
        <Chip label="N° ↓"   active={p.sort === 'num-desc'}  onPress={() => p.onSort('num-desc')} />
        <Chip label="A → Z"  active={p.sort === 'name-asc'}  onPress={() => p.onSort('name-asc')} />
        <Chip label="Z → A"  active={p.sort === 'name-desc'} onPress={() => p.onSort('name-desc')} />
      </ScrollView>

      {hasFilters && (
        <Pressable onPress={p.onReset} style={styles.reset}>
          <Text style={styles.resetText}>Réinitialiser les filtres</Text>
        </Pressable>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.sm, gap: 6, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.text, backgroundColor: colors.surfaceAlt },
  chipRow: { gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted },
  chipTextActive: { color: 'white', fontWeight: '600' },
  reset: { alignSelf: 'flex-end', padding: 4 },
  resetText: { fontSize: 12, color: colors.danger },

  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxHeight: '60%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetDesktop: { width: 400, height: 500, borderRadius: radius.xl, marginBottom: 40 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  close: { fontSize: 20, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowLabel: { fontSize: 14, color: colors.text },
  check: { color: colors.success, fontSize: 16, fontWeight: '700' },
});
