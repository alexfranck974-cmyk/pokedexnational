import { useMemo, useState } from 'react';
import { View, Text, TextInput, Image, Pressable, FlatList, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { withReturnTo } from '@/lib/navigation';
import { useLocale, useT } from '@/lib/locale';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Floating action button visible on every (app) screen (rendered once from
// app/(app)/_layout.tsx) — a quick way to jump straight to any Pokémon's
// detail page without first navigating to the Pokédex tab. Deliberately a
// simple name/number lookup, not the Pokédex's own full filter set — this is
// a shortcut, not a replacement for SearchFilterBar.
export function GlobalSearchBubble({ style }: { style?: object }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = useT();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return POKEDEX.filter(p => {
      const numMatch = String(p.num).padStart(4, '0').includes(q) || String(p.num).includes(q);
      return numMatch || normalize(getName(p, locale)).includes(q);
    }).slice(0, 30);
  }, [query, locale]);

  const close = () => { setOpen(false); setQuery(''); };
  const select = (num: number) => {
    close();
    router.push(withReturnTo(`/pokemon/${num}`, pathname) as never);
  };

  const styles = useThemedStyles((colors, shadow) => ({
    fab: {
      width: 44, height: 44, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surface, ...shadow.md,
    },
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const },
    sheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: radius.bubble, borderTopRightRadius: radius.bubble,
      maxHeight: '75%' as const, paddingBottom: spacing.lg,
    },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: spacing.md, gap: spacing.sm },
    title: { fontSize: 16, fontFamily: fonts.display, color: colors.text, flex: 1 },
    input: {
      marginHorizontal: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10,
      borderRadius: radius.md, backgroundColor: colors.surfaceAlt, fontSize: 15, fontFamily: fonts.body, color: colors.text,
    },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
    sprite: { width: 40, height: 40 },
    num: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim, width: 44 },
    name: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text, flex: 1 },
    empty: { padding: spacing.lg, textAlign: 'center' as const, fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  }));

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fab, style]}
        accessibilityRole="button"
        accessibilityLabel={t('appLayout.a11ySearch')}>
        <Ionicons name="search" size={20} color={colors.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('globalSearch.title')}</Text>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('globalSearch.placeholder')}
              placeholderTextColor={colors.textDim}
              style={styles.input}
              autoFocus={Platform.OS === 'web'}
              autoCorrect={false}
            />
            <FlatList
              data={results}
              keyExtractor={p => String(p.num)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={query.trim() ? <Text style={styles.empty}>{t('globalSearch.noResults')}</Text> : null}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => select(item.num)}>
                  <Image source={{ uri: item.sprite_url }} style={styles.sprite} resizeMode="contain" />
                  <Text style={styles.num}>#{String(item.num).padStart(4, '0')}</Text>
                  <Text style={styles.name}>{getName(item, locale)}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
