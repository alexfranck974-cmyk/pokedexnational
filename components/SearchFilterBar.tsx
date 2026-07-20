import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
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

const CHIP = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export function SearchFilterBar(p: Props) {
  const hasFilters = p.statusFilter !== 'all' || p.typeFilter || p.setFilter || p.rarityFilter;

  return (
    <View style={styles.wrap}>
      <TextInput placeholder="Rechercher (nom ou n°)" value={p.search} onChangeText={p.onSearch}
        style={styles.search} autoCapitalize="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <CHIP label="Tous" active={p.statusFilter === 'all'} onPress={() => p.onStatus('all')} />
        <CHIP label="Possédés" active={p.statusFilter === 'owned'} onPress={() => p.onStatus('owned')} />
        <CHIP label="Manquants" active={p.statusFilter === 'missing'} onPress={() => p.onStatus('missing')} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <CHIP label="Type" active={p.typeFilter !== null}
          onPress={() => {
            const types = Object.keys(TYPE_LABEL_FR) as PokemonType[];
            const idx = p.typeFilter ? types.indexOf(p.typeFilter) : -1;
            const next = idx === types.length - 1 ? null : types[idx + 1];
            p.onType(next);
          }} />
        {p.typeFilter && <Text style={styles.pill}>{TYPE_LABEL_FR[p.typeFilter]}</Text>}

        <CHIP label="Set" active={p.setFilter !== null}
          onPress={() => {
            const idx = p.setFilter ? p.sets.findIndex(s => s.id === p.setFilter) : -1;
            const next = idx === p.sets.length - 1 ? null : p.sets[idx + 1]?.id ?? null;
            p.onSet(next);
          }} />
        {p.setFilter && <Text style={styles.pill}>{p.sets.find(s => s.id === p.setFilter)?.name ?? p.setFilter}</Text>}

        <CHIP label="Rareté" active={p.rarityFilter !== null}
          onPress={() => {
            const idx = p.rarityFilter ? p.rarities.indexOf(p.rarityFilter) : -1;
            const next = idx === p.rarities.length - 1 ? null : p.rarities[idx + 1] ?? null;
            p.onRarity(next);
          }} />
        {p.rarityFilter && <Text style={styles.pill}>{p.rarityFilter}</Text>}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <CHIP label="N° ↑"   active={p.sort === 'num-asc'}   onPress={() => p.onSort('num-asc')} />
        <CHIP label="N° ↓"   active={p.sort === 'num-desc'}  onPress={() => p.onSort('num-desc')} />
        <CHIP label="A → Z"  active={p.sort === 'name-asc'}  onPress={() => p.onSort('name-asc')} />
        <CHIP label="Z → A"  active={p.sort === 'name-desc'} onPress={() => p.onSort('name-desc')} />
      </ScrollView>

      {hasFilters && (
        <Pressable onPress={p.onReset} style={styles.reset}>
          <Text style={styles.resetText}>Réinitialiser les filtres</Text>
        </Pressable>
      )}
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
  pill: { fontSize: 12, color: '#555', marginLeft: 4 },
  reset: { alignSelf: 'flex-end', padding: 4 },
  resetText: { fontSize: 12, color: '#c00' },
});
