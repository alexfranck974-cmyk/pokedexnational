import { View, Text, StyleSheet } from 'react-native';
import type { PokemonType } from '@/lib/types';
import { TYPE_COLORS, getTypeLabel } from '@/lib/types-colors';
import { useLocale } from '@/lib/locale';
import { radius } from '@/lib/theme';

export function TypeBadge({ type }: { type: PokemonType }) {
  const { locale } = useLocale();
  return (
    <View style={[styles.badge, { backgroundColor: TYPE_COLORS[type] }]}>
      <Text style={styles.text}>{getTypeLabel(type, locale)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  text: { color: 'white', fontSize: 11, fontWeight: '700' },
});
