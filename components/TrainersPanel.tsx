import { useMemo, useState, type ReactElement } from 'react';
import { View, Text, TextInput, ActivityIndicator, Pressable, Image, useWindowDimensions, type RefreshControlProps } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { CardGallery } from './CardGallery';
import { CardFilterTree } from './CardFilterTree';
import { CardZoomModal } from './CardZoomModal';
import { CardCopySheet, EditCopyFooterButton } from './CardCopySheet';
import type { TcgCardRow } from '@/lib/tcg';
import { useTrainerCards } from '@/lib/tcg';
import { useAllOwnedCardIds, useToggleOwnedCard, useOwnedCardQuantities, useAdjustOwnedCardQuantity, useOwnedCardFinishes } from '@/lib/collection';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useT } from '@/lib/locale';
import { BackButton } from './BackButton';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Derives the depicted Trainer's name from a card's title, so every printing/effect
// of the same character groups together (e.g. "Misty's Vitality", "Misty's Water
// Command" → "Misty"). Prefers a name given in parentheses (modern "Professor's
// Research (Professor Sada)" style cards), then a possessive prefix ("Cynthia's
// Ambition" → "Cynthia"), then strips a trailing "◇" variant marker. Falls back to
// the full name unchanged for duo cards ("Jessie & James") and generic archetypes
// ("Youngster") — a small, acceptable margin of imprecision, not worth over-engineering.
function extractCharacterKey(name: string): string {
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) return parenMatch[1].trim();
  const possessiveMatch = name.match(/^(.+?)'s\s/);
  if (possessiveMatch) return possessiveMatch[1].trim();
  return name.replace(/\s*◇\s*$/, '').trim();
}

interface CharacterGroup {
  key: string;
  cards: TcgCardRow[];
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 7;
}

type TrainerStatusFilter = 'all' | 'owned' | 'missing';

interface Props {
  userId?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}

// Embedded inline as one of Favoris' subtabs (not a routed page) so switching
// between Extensions/Dresseurs/Favoris/Mes listes feels like one continuous
// screen — own header handles just the "grid vs selected character" state,
// the outer Favoris header still owns the persistent tab row above it.
export function TrainersPanel({ userId, refreshControl }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const t = useT();
  const { data: cards = [], isLoading: cardsLoading } = useTrainerCards();
  const { data: ownedAll = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: finishesByCard } = useOwnedCardFinishes(userId);
  const toggleOwned = useToggleOwnedCard();
  const adjustQuantity = useAdjustOwnedCardQuantity();

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TrainerStatusFilter>('all');
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string> | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);
  const [detailsCard, setDetailsCard] = useState<TcgCardRow | null>(null);

  const setFilteredCards = useMemo(
    () => selectedSetIds === null ? cards : cards.filter(c => selectedSetIds.has(c.set_id)),
    [cards, selectedSetIds],
  );

  const groups = useMemo(() => {
    const byKey = new Map<string, TcgCardRow[]>();
    for (const c of setFilteredCards) {
      const key = extractCharacterKey(c.name);
      const list = byKey.get(key);
      if (list) list.push(c); else byKey.set(key, [c]);
    }
    return Array.from(byKey.entries())
      .map(([key, groupCards]) => ({ key, cards: groupCards }) as CharacterGroup)
      .sort((a, b) => a.key.localeCompare(b.key, 'fr', { sensitivity: 'base' }));
  }, [setFilteredCards]);

  // Debounced: typing quickly can shrink `visibleGroups` from 300+ to a
  // handful on every keystroke. FlashList's grid layout manager has a known
  // crash when its `data` length drops abruptly in quick succession — see
  // lib/use-debounced-value.ts for details.
  const debouncedSearch = useDebouncedValue(search, 200);
  const visibleGroups = useMemo(() => {
    const q = normalize(debouncedSearch.trim());
    return groups.filter(g => {
      if (q && !normalize(g.key).includes(q)) return false;
      const owned = g.cards.some(c => ownedAll.has(c.id));
      if (statusFilter === 'owned' && !owned) return false;
      if (statusFilter === 'missing' && owned) return false;
      return true;
    });
  }, [groups, debouncedSearch, statusFilter, ownedAll]);

  const selectedGroup = useMemo(
    () => selectedCharacter ? groups.find(g => g.key === selectedCharacter) ?? null : null,
    [groups, selectedCharacter],
  );

  const styles = useThemedStyles((colors) => ({
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.display, color: colors.text },
    viewToggle: { flexDirection: 'row' as const, gap: 6 },
    viewBtn: {
      width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surfaceAlt,
    },
    viewBtnActive: { backgroundColor: colors.primary },
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
    grid: { padding: spacing.sm, paddingBottom: TAB_BAR_CLEARANCE },
    tile: { flex: 1, padding: 6, alignItems: 'center' as const },
    tileAvatarWrap: { width: '100%' as const, position: 'relative' as const },
    tileImg: {
      width: '100%' as const, aspectRatio: 1, borderRadius: radius.bubble, backgroundColor: colors.surfaceAlt,
      borderWidth: 2, borderColor: 'transparent',
    },
    tileImgOwned: { borderColor: colors.success },
    tileImgMissing: { opacity: 0.55 },
    tileCountBadge: {
      position: 'absolute' as const, bottom: -2, right: '8%' as const, minWidth: 20, height: 20, borderRadius: 10,
      paddingHorizontal: 5, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    tileCountBadgeText: { fontSize: 10, fontFamily: fonts.monoBold, color: colors.textMuted },
    tileName: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const, marginTop: 6 },
    tileNameMissing: { color: colors.textMuted },
  }));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        {selectedCharacter ? (
          <>
            <BackButton onPress={() => setSelectedCharacter(null)} style={styles.back} size={20} />
            <Text style={styles.headerTitle} numberOfLines={1}>{selectedCharacter}</Text>
            <View style={styles.viewToggle}>
              <Pressable onPress={() => setViewMode('grid')} style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]} accessibilityRole="button" accessibilityLabel={t('trainers.a11yGridView')}>
                <Ionicons name="grid" size={15} color={viewMode === 'grid' ? 'white' : colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => setViewMode('list')} style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]} accessibilityRole="button" accessibilityLabel={t('trainers.a11yListView')}>
                <Ionicons name="list" size={15} color={viewMode === 'list' ? 'white' : colors.textMuted} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>
              {t(groups.length > 1 ? 'trainers.countPlural' : 'trainers.countSingular', { n: groups.length })}
            </Text>
            <Pressable onPress={() => setSearchOpen(o => !o)} style={styles.searchBtn} accessibilityRole="button" accessibilityLabel={t(searchOpen ? 'search.a11yClear' : 'search.a11yToggleSearch')}>
              <Ionicons name={searchOpen ? 'close' : 'search'} size={16} color={colors.text} />
            </Pressable>
          </>
        )}
      </View>

      {!selectedCharacter && searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            placeholder={t('trainers.searchPlaceholder')}
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

      {!selectedCharacter && (
        <>
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
          <CardFilterTree cards={cards} selectedSetIds={selectedSetIds} onChange={setSelectedSetIds} />
        </>
      )}

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : selectedGroup ? (
        <CardGallery
          cards={selectedGroup.cards}
          ownedSet={ownedAll}
          readOnly={false}
          viewMode={viewMode}
          quantities={quantities}
          onIncrement={c => adjustQuantity.mutate({ cardId: c.id, delta: 1, currentQuantity: quantities.get(c.id) ?? 0, rarity: c.rarity })}
          onDecrement={c => adjustQuantity.mutate({ cardId: c.id, delta: -1, currentQuantity: quantities.get(c.id) ?? 0 })}
          onToggle={c => toggleOwned.mutate({ cardId: c.id, currentlyOwned: ownedAll.has(c.id), rarity: c.rarity })}
          onZoom={c => setZoomCard(c)}
          onOpenDetails={c => setDetailsCard(c)}
          finishesByCard={finishesByCard}
        />
      ) : visibleGroups.length === 0 ? (
        <Text style={styles.empty}>{t('trainers.notFound')}</Text>
      ) : (
        <FlashList
          data={visibleGroups}
          numColumns={numColsFor(width)}
          estimatedItemSize={150}
          contentContainerStyle={styles.grid}
          maintainVisibleContentPosition={{ disabled: true }}
          refreshControl={refreshControl}
          keyExtractor={g => g.key}
          renderItem={({ item }) => {
            if (!item) return null;
            const owned = item.cards.some(c => ownedAll.has(c.id));
            return (
              <Pressable style={styles.tile} onPress={() => setSelectedCharacter(item.key)}>
                <View style={styles.tileAvatarWrap}>
                  <Image
                    source={{ uri: item.cards[0].image_small }}
                    style={[styles.tileImg, owned && styles.tileImgOwned, !owned && styles.tileImgMissing]}
                    resizeMode="contain"
                  />
                  <View style={styles.tileCountBadge}>
                    <Text style={styles.tileCountBadgeText}>×{item.cards.length}</Text>
                  </View>
                </View>
                <Text style={[styles.tileName, !owned && styles.tileNameMissing]} numberOfLines={1}>{item.key}</Text>
              </Pressable>
            );
          }}
        />
      )}
      <CardZoomModal
        card={zoomCard}
        onClose={() => setZoomCard(null)}
        footer={zoomCard && ownedAll.has(zoomCard.id) ? (
          <EditCopyFooterButton onPress={() => { setDetailsCard(zoomCard); setZoomCard(null); }} />
        ) : undefined}
      />
      <CardCopySheet card={detailsCard} onClose={() => setDetailsCard(null)} />
    </View>
  );
}
