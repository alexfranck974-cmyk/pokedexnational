import { View, Text } from 'react-native';
import { useThemedStyles, radius, fonts } from '@/lib/theme';

interface Props {
  owned: number;
  total: number;
  cardCount?: number;
  filterHint?: string;
}

export function ProgressCounter({ owned, total, cardCount, filterHint }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const clamped = Math.min(100, Math.max(0, pct));
  const styles = useThemedStyles((colors) => ({
    wrap: { gap: 6 },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: 6 },
    main: { fontSize: 14, fontFamily: fonts.monoBold, color: colors.text },
    pct: { color: colors.textMuted, fontFamily: fonts.mono },
    sub: { fontSize: 14, fontFamily: fonts.mono, color: colors.textMuted },
    hint: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
    track: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' as const },
    fill: { height: '100%' as const, backgroundColor: colors.success, borderRadius: radius.pill },
  }));

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
