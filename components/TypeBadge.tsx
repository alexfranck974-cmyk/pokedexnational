import { View, Text, StyleSheet } from 'react-native';
import type { PokemonType } from '@/lib/types';
import { TYPE_COLORS, TYPE_LABEL_FR } from '@/lib/types-colors';

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <View style={[styles.badge, { backgroundColor: TYPE_COLORS[type] }]}>
      <Text style={styles.text}>{TYPE_LABEL_FR[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  text: { color: 'white', fontSize: 12, fontWeight: '700' },
});
