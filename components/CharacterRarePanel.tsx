import { useMemo, useState, type ReactElement } from 'react';
import { View, Text, TextInput, ActivityIndicator, Pressable, Image, ScrollView, type RefreshControlProps } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { CardZoomModal } from './CardZoomModal';
import { Pokeball } from './Pokeball';
import type { TcgCardRow } from '@/lib/tcg';
import { useCharacterRareCards } from '@/lib/tcg';
import { useAllOwnedCardIds, useAllWishedCards, useToggleWish } from '@/lib/collection';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useT, useLocale } from '@/lib/locale';
import { getName } from '@/lib/i18n';
import type { Pokemon } from '@/lib/types';
import pokedexData from '@/data/pokedex.json';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface DuoGroup { dexNum: number; cards: TcgCardRow[]; }

type StatusFilter = 'all' | 'owned' | 'missing';

interface Props {
  userId?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}

// Embedded as a Favoris subtab (not a routed page), same spirit as
// TrainersPanel — a curated slice of the TCG index rather than the user's own
// collection, browsed Pokédex-order with a heart to wishlist a card straight
// from here. See useCharacterRareCards for what actually qualifies a card.
export function CharacterRarePanel({ userId, refreshControl }: Props) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const t = useT();
  const { data: cards = [], isLoading: cardsLoading } = useCharacterRareCards();
  const { data: ownedAll = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const wishedIds = useMemo(() => new Set(wishedCards.map(c => c.id)), [wishedCards]);
  const toggleWish = useToggleWish();

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);

  const groups = useMemo(() => {
    const byDex = new Map<number, TcgCardRow[]>();
    for (const c of cards) {
      if (c.dex_num == null) continue;
      const list = byDex.get(c.dex_num);
      if (list) list.push(c); else byDex.set(c.dex_num, [c]);
    }
    return Array.from(byDex.entries())
      .map(([dexNum, groupCards]) => ({ dexNum, cards: groupCards }) as DuoGroup)
      .sort((a, b) => a.dexNum - b.dexNum);
  }, [cards]);

  // Debounced for the same reason as TrainersPanel/wishlist — a fast-shrinking
  // FlashList data array is unsafe, see lib/use-debounced-value.ts.
  const debouncedSearch = useDebouncedValue(search, 200);
  const visibleGroups = useMemo(() => {
    const q = normalize(debouncedSearch.trim());
    return groups.filter(g => {
      const owned = g.cards.some(c => ownedAll.has(c.id));
      if (statusFilter === 'owned' && !owned) return false;
      if (statusFilter === 'missing' && owned) return false;
      if (q) {
        const mon = POKEDEX_BY_DEX.get(g.dexNum);
        const monName = mon ? normalize(getName(mon, locale)) : '';
        const dexMatch = String(g.dexNum).includes(q) || String(g.dexNum).padStart(3, '0').includes(q);
        if (!monName.includes(q) && !dexMatch) return false;
      }
      return true;
    });
  }, [groups, debouncedSearch, statusFilter, ownedAll, locale]);

  const styles = useThemedStyles((colors, shadow) => ({
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.display, color: colors.text },
    searchBtn: {
      width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surfaceAlt,
    },
    searchRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.body, color: colors.text, padding: 0 },
    statusRow: { flexDirection: 'row' as const, gap: 6, margin: spacing.md, marginBottom: 0 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    chipTextActive: { color: 'white', fontFamily: fonts.bodyBold },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: 24, fontStyle: 'italic' as const },
    list: { paddingBottom: TAB_BAR_CLEARANCE },
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.sm,
      borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    },
    sprite: { width: 40, height: 40 },
    info: { gap: 2, marginRight: spacing.sm },
    name: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text, width: 108 },
    sub: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, width: 108 },
    thumbs: { flex: 1 },
    thumbWrap: { position: 'relative' as const, marginRight: spacing.sm },
    thumbImgWrap: { borderRadius: radius.md, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    thumbImg: { width: 64, aspectRatio: 0.72 },
    pokeballOverlay: { position: 'absolute' as const, top: 3, left: 3, backgroundColor: colors.overlay, borderRadius: radius.pill, padding: 2 },
    heartBtn: {
      position: 'absolute' as const, top: 3, right: 3, width: 22, height: 22,
      borderRadius: radius.pill, backgroundColor: colors.overlay,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heartFilled: { fontSize: 13, color: colors.danger, lineHeight: 16 },
    heartOutline: { fontSize: 13, color: 'white', lineHeight: 16 },
  }));

  const wishMutate = toggleWish.mutate;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t(groups.length > 1 ? 'duoCards.countPlural' : 'duoCards.countSingular', { n: groups.length })}
        </Text>
        <Pressable onPress={() => setSearchOpen(o => !o)} style={styles.searchBtn} accessibilityRole="button" accessibilityLabel={t(searchOpen ? 'search.a11yClear' : 'search.a11yToggleSearch')}>
          <Ionicons name={searchOpen ? 'close' : 'search'} size={16} color={colors.text} />
        </Pressable>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            placeholder={t('duoCards.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoFocus
            style={styles.searchInput}
            onBlur={() => { if (!search) setSearchOpen(false); }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); setSearchOpen(false); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('search.a11yClear')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.statusRow}>
        <Pressable onPress={() => setStatusFilter('all')} style={[styles.chip, statusFilter === 'all' && styles.chipActive]}>
          <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>{t('common.all')}</Text>
        </Pressable>
        <Pressable onPress={() => setStatusFilter('owned')} style={[styles.chip, statusFilter === 'owned' && styles.chipActive]}>
          <Text style={[styles.chipText, statusFilter === 'owned' && styles.chipTextActive]}>{t('statBreakdown.owned')}</Text>
        </Pressable>
        <Pressable onPress={() => setStatusFilter('missing')} style={[styles.chip, statusFilter === 'missing' && styles.chipActive]}>
          <Text style={[styles.chipText, statusFilter === 'missing' && styles.chipTextActive]}>{t('statBreakdown.missing')}</Text>
        </Pressable>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : visibleGroups.length === 0 ? (
        <Text style={styles.empty}>{t('duoCards.notFound')}</Text>
      ) : (
        <FlashList
          data={visibleGroups}
          contentContainerStyle={styles.list}
          maintainVisibleContentPosition={{ disabled: true }}
          refreshControl={refreshControl}
          keyExtractor={g => String(g.dexNum)}
          renderItem={({ item }) => {
            if (!item) return null;
            const mon = POKEDEX_BY_DEX.get(item.dexNum);
            return (
              <View style={styles.row}>
                <View style={styles.info}>
                  {mon && <Image source={{ uri: mon.sprite_url }} style={styles.sprite} resizeMode="contain" />}
                  <Text style={styles.name} numberOfLines={1}>
                    #{String(item.dexNum).padStart(4, '0')} {mon ? getName(mon, locale) : ''}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {t(item.cards.length > 1 ? 'duoCards.cardsCountPlural' : 'duoCards.cardsCountSingular', { n: item.cards.length })}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
                  {item.cards.map(c => {
                    const owned = ownedAll.has(c.id);
                    const wished = wishedIds.has(c.id);
                    return (
                      <Pressable key={c.id} onPress={() => setZoomCard(c)} style={styles.thumbWrap}>
                        <View style={styles.thumbImgWrap}>
                          <Image source={{ uri: c.image_small }} style={styles.thumbImg} resizeMode="contain" />
                        </View>
                        {owned && (
                          <View style={styles.pokeballOverlay}>
                            <Pokeball size={16} />
                          </View>
                        )}
                        <Pressable
                          hitSlop={6}
                          onPress={(e) => { e.stopPropagation(); wishMutate({ cardId: c.id, currentlyWished: wished, dexNum: item.dexNum }); }}
                          style={styles.heartBtn}>
                          <Text style={wished ? styles.heartFilled : styles.heartOutline}>{wished ? '♥' : '♡'}</Text>
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          }}
        />
      )}
      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
    </View>
  );
}
