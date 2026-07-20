import { View, Text, StyleSheet } from 'react-native';
import type { PokemonType } from '@/lib/types';
import { TYPE_COLORS, TYPE_LABEL_FR } from '@/lib/types-colors';
import { radius } from '@/lib/theme';

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <View style={[styles.badge, { backgroundColor: TYPE_COLORS[type] }]}>
      <Text style={styles.text}>{TYPE_LABEL_FR[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  text: { color: 'white', fontSize: 11, fontWeight: '700' },
});
