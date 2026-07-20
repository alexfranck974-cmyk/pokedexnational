import { View, Text, StyleSheet } from 'react-native';

interface Props {
  owned: number;
  total: number;
  cardCount?: number;
  filterHint?: string;
}

export function ProgressCounter({ owned, total, cardCount, filterHint }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <View style={styles.wrap}>
      <Text style={styles.main}>
        {owned} / {total} <Text style={styles.pct}>({pct}%)</Text>
      </Text>
      {cardCount !== undefined && <Text style={styles.sub}>· {cardCount} cartes</Text>}
      {filterHint && <Text style={styles.hint}>— filtre : {filterHint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  main: { fontSize: 14, fontWeight: '600' },
  pct: { color: '#666', fontWeight: '400' },
  sub: { fontSize: 14, color: '#444' },
  hint: { fontSize: 12, color: '#888' },
});
