import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '@/lib/theme';

interface Props {
  owned: number;
  total: number;
  cardCount?: number;
  filterHint?: string;
}

export function ProgressCounter({ owned, total, cardCount, filterHint }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.main}>
          {owned} / {total} <Text style={styles.pct}>({pct}%)</Text>
        </Text>
        {cardCount !== undefined && <Text style={styles.sub}>· {cardCount} cartes</Text>}
        {filterHint && <Text style={styles.hint}>— filtre : {filterHint}</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  main: { fontSize: 14, fontWeight: '700', color: colors.text },
  pct: { color: colors.textMuted, fontWeight: '400' },
  sub: { fontSize: 14, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textDim, fontStyle: 'italic' },
  track: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.success, borderRadius: radius.pill },
});
