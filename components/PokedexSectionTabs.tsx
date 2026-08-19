import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';
import type { StringKey } from '@/lib/strings';

export type PokedexSection = 'pokedex' | 'collection' | 'wishlist';

const SECTIONS: { key: PokedexSection; labelKey: StringKey; href: '/pokedex' | '/favorites' | '/wishlist' }[] = [
  { key: 'pokedex', labelKey: 'tabs.pokedex', href: '/pokedex' },
  { key: 'collection', labelKey: 'tabs.collection', href: '/favorites' },
  { key: 'wishlist', labelKey: 'tabs.wishlist', href: '/wishlist' },
];

interface Props {
  active: PokedexSection;
}

// Real navigation (router.replace) between three sibling routes, not local
// component-swap state — so every existing from/fallback string pointing at
// /pokedex, /favorites or /wishlist (useBackTo, enterPokemonDetail, ...)
// keeps working unchanged, and returning from a pushed detail screen lands
// back on the exact section it was opened from.
export function PokedexSectionTabs({ active }: Props) {
  const router = useRouter();
  const t = useT();
  const styles = useThemedStyles((colors) => ({
    row: {
      flexDirection: 'row' as const, gap: spacing.xs, padding: spacing.sm,
      backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    tabBtnActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    tabTextActive: { color: 'white' },
  }));

  return (
    <View style={styles.row}>
      {SECTIONS.map(s => (
        <Pressable
          key={s.key}
          onPress={() => { if (s.key !== active) router.replace(s.href as never); }}
          style={[styles.tabBtn, s.key === active && styles.tabBtnActive]}>
          <Text style={[styles.tabText, s.key === active && styles.tabTextActive]}>{t(s.labelKey)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
