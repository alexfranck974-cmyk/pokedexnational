import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';

interface Props {
  cards: TcgCardRow[];
  selectedSetIds: Set<string> | null;
  onChange: (v: Set<string> | null) => void;
}

interface SetEntry { id: string; name: string; count: number; releaseDate: string | null; }
interface SeriesGroup { series: string; sets: SetEntry[]; total: number; latestDate: string; }

function buildGroups(cards: TcgCardRow[]): SeriesGroup[] {
  const bySeries = new Map<string, Map<string, SetEntry>>();
  for (const c of cards) {
    const series = c.series ?? 'Autres';
    let inner = bySeries.get(series);
    if (!inner) { inner = new Map(); bySeries.set(series, inner); }
    const existing = inner.get(c.set_id);
    if (existing) existing.count++;
    else inner.set(c.set_id, { id: c.set_id, name: c.set_name, count: 1, releaseDate: c.release_date });
  }
  const groups: SeriesGroup[] = [];
  for (const [series, setsMap] of bySeries) {
    const sets = Array.from(setsMap.values()).sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
    const total = sets.reduce((s, e) => s + e.count, 0);
    const latestDate = sets[0]?.releaseDate ?? '';
    groups.push({ series, sets, total, latestDate });
  }
  return groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
}

export function CardFilterTree({ cards, selectedSetIds, onChange }: Props) {
  const groups = useMemo(() => buildGroups(cards), [cards]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isSetSelected = (setId: string) =>
    selectedSetIds === null || selectedSetIds.has(setId);
  const isSeriesFullySelected = (g: SeriesGroup) =>
    g.sets.every(s => isSetSelected(s.id));

  const toggleSet = (setId: string) => {
    const allSetIds = groups.flatMap(g => g.sets.map(s => s.id));
    const current = selectedSetIds ?? new Set(allSetIds);
    const next = new Set(current);
    if (next.has(setId)) next.delete(setId);
    else next.add(setId);
    if (next.size === allSetIds.length) onChange(null);
    else onChange(next);
  };

  const toggleSeries = (g: SeriesGroup) => {
    const allSetIds = groups.flatMap(g => g.sets.map(s => s.id));
    const current = selectedSetIds ?? new Set(allSetIds);
    const next = new Set(current);
    const seriesAllSelected = g.sets.every(s => next.has(s.id));
    if (seriesAllSelected) g.sets.forEach(s => next.delete(s.id));
    else g.sets.forEach(s => next.add(s.id));
    if (next.size === allSetIds.length) onChange(null);
    else onChange(next);
  };

  const toggleExpanded = (series: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  };

  if (groups.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Filtrer par extension</Text>
        {selectedSetIds !== null && (
          <Pressable onPress={() => onChange(null)}>
            <Text style={styles.reset}>Effacer</Text>
          </Pressable>
        )}
      </View>
      <ScrollView style={styles.list} nestedScrollEnabled>
        {groups.map(g => {
          const isOpen = expanded.has(g.series);
          const seriesChecked = isSeriesFullySelected(g);
          return (
            <View key={g.series}>
              <Pressable onPress={() => toggleExpanded(g.series)} style={styles.row}>
                <Text style={styles.chevron}>{isOpen ? '▼' : '▶'}</Text>
                <Pressable onPress={(e) => { e.stopPropagation(); toggleSeries(g); }} hitSlop={6}>
                  <Text style={styles.check}>{seriesChecked ? '☑' : '☐'}</Text>
                </Pressable>
                <Text style={styles.seriesName}>{g.series}</Text>
                <Text style={styles.count}>({g.total})</Text>
              </Pressable>
              {isOpen && g.sets.map(s => (
                <Pressable key={s.id} onPress={() => toggleSet(s.id)} style={[styles.row, styles.subRow]}>
                  <Text style={styles.check}>{isSetSelected(s.id) ? '☑' : '☐'}</Text>
                  <Text style={styles.setName}>{s.name}</Text>
                  <Text style={styles.count}>({s.count})</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'white', borderRadius: 8, marginHorizontal: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e0e0e0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  title: { fontSize: 14, fontWeight: '700' },
  reset: { fontSize: 12, color: '#c00' },
  list: { maxHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  subRow: { paddingLeft: 34, backgroundColor: '#fafafa' },
  chevron: { width: 12, fontSize: 10, color: '#666' },
  check: { fontSize: 14 },
  seriesName: { fontSize: 14, fontWeight: '600', flex: 1 },
  setName: { fontSize: 13, flex: 1 },
  count: { fontSize: 12, color: '#666' },
});
