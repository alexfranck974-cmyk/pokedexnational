import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, FlatList, useWindowDimensions } from 'react-native';
import type { PokemonType } from '@/lib/types';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { TYPE_LABEL_FR } from '@/lib/types-colors';

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
  wrap: { padding: 8, gap: 6, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  chipRow: { gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#111' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  reset: { alignSelf: 'flex-end', padding: 4 },
  resetText: { fontSize: 12, color: '#c00' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxHeight: '60%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetDesktop: { width: 400, height: 500, borderRadius: 16, marginBottom: 40 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  close: { fontSize: 20, color: '#555' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  rowPressed: { backgroundColor: '#f5f5f5' },
  rowLabel: { fontSize: 14 },
  check: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
});
