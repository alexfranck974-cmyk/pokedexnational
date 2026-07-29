import { useMemo, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Pressable, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CardGallery } from '@/components/CardGallery';
import { CardFilterTree } from '@/components/CardFilterTree';
import { CardZoomModal } from '@/components/CardZoomModal';
import type { TcgCardRow } from '@/lib/tcg';
import { useTrainerCards } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import { useAllOwnedCardIds, useToggleOwnedCard } from '@/lib/collection';
import { useBackTo } from '@/lib/navigation';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

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

export default function TrainersScreen() {
  const router = useRouter();
  const goBackToOrigin = useBackTo('/favorites');
  const { session } = useSession();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();

  const { data: cards = [], isLoading: cardsLoading } = useTrainerCards();
  const { data: ownedAll = new Set<string>() } = useAllOwnedCardIds(userId);
  const toggleOwned = useToggleOwnedCard();

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TrainerStatusFilter>('all');
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string> | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);

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

  const visibleGroups = useMemo(() => {
    const q = normalize(search.trim());
    return groups.filter(g => {
      if (q && !normalize(g.key).includes(q)) return false;
      const owned = g.cards.some(c => ownedAll.has(c.id));
      if (statusFilter === 'owned' && !owned) return false;
      if (statusFilter === 'missing' && owned) return false;
      return true;
    });
  }, [groups, search, statusFilter, ownedAll]);

  const selectedGroup = useMemo(
    () => selectedCharacter ? groups.find(g => g.key === selectedCharacter) ?? null : null,
    [groups, selectedCharacter],
  );

  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: { padding: spacing.md, gap: spacing.sm, ...shadow.sm },
    heroTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: 'white', fontSize: 14, fontFamily: fonts.body },
    heroViewToggle: { flexDirection: 'row' as const, gap: 6 },
    viewBtn: {
      width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    viewBtnActive: { backgroundColor: 'white' },
    heroTitle: { fontSize: 20, fontFamily: fonts.display, color: 'white' },
    heroCaption: { fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    statusRow: { flexDirection: 'row' as const, gap: 6, margin: spacing.md, marginBottom: 0 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    chipTextActive: { color: 'white', fontFamily: fonts.bodyBold },
    searchOverlay: { position: 'absolute' as const, right: spacing.lg, bottom: spacing.lg, alignItems: 'flex-end' as const, gap: spacing.sm },
    searchFab: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, ...shadow.md,
    },
    floatingSearch: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm, width: 240, ...shadow.md,
    },
    floatingSearchInput: { flex: 1, fontSize: 15, fontFamily: fonts.body, color: colors.text, padding: 0 },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: 24, fontStyle: 'italic' as const },
    grid: { padding: spacing.sm },
    tile: { flex: 1, padding: 6, alignItems: 'center' as const },
    tileImg: { width: '100%' as const, aspectRatio: 0.72, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
    tileImgMissing: { opacity: 0.55 },
    tileName: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const, marginTop: 4 },
    tileNameMissing: { color: colors.textMuted },
    tileCount: { fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted },
  }));

  const back = () => {
    if (selectedCharacter) setSelectedCharacter(null);
    else goBackToOrigin();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={back} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color="white" />
            <Text style={styles.backText}>{selectedCharacter ? 'Dresseurs' : 'Collections'}</Text>
          </Pressable>
          {selectedCharacter && (
            <View style={styles.heroViewToggle}>
              <Pressable
                onPress={() => setViewMode('grid')}
                style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}>
                <Ionicons name="grid" size={15} color={viewMode === 'grid' ? colors.primary : 'white'} />
              </Pressable>
              <Pressable
                onPress={() => setViewMode('list')}
                style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}>
                <Ionicons name="list" size={15} color={viewMode === 'list' ? colors.primary : 'white'} />
              </Pressable>
            </View>
          )}
        </View>
        <Text style={styles.heroTitle}>{selectedCharacter ?? 'Cartes Dresseur'}</Text>
        <Text style={styles.heroCaption}>
          {selectedGroup
            ? `${selectedGroup.cards.length} carte${selectedGroup.cards.length > 1 ? 's' : ''}`
            : `${groups.length} dresseur${groups.length > 1 ? 's' : ''}`}
        </Text>
      </LinearGradient>

      {!selectedCharacter && (
        <>
          <View style={styles.statusRow}>
            <Pressable onPress={() => setStatusFilter('all')} style={[styles.chip, statusFilter === 'all' && styles.chipActive]}>
              <Text style={[styles.chipText, statusFilter === 'all' && styles.chipTextActive]}>Tous</Text>
            </Pressable>
            <Pressable onPress={() => setStatusFilter('owned')} style={[styles.chip, statusFilter === 'owned' && styles.chipActive]}>
              <Text style={[styles.chipText, statusFilter === 'owned' && styles.chipTextActive]}>Possédés</Text>
            </Pressable>
            <Pressable onPress={() => setStatusFilter('missing')} style={[styles.chip, statusFilter === 'missing' && styles.chipActive]}>
              <Text style={[styles.chipText, statusFilter === 'missing' && styles.chipTextActive]}>Manquants</Text>
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
          onToggle={c => toggleOwned.mutate({ cardId: c.id, currentlyOwned: ownedAll.has(c.id) })}
          onZoom={c => setZoomCard(c)}
        />
      ) : visibleGroups.length === 0 ? (
        <Text style={styles.empty}>Aucun dresseur trouvé.</Text>
      ) : (
        <FlashList
          data={visibleGroups}
          numColumns={numColsFor(width)}
          estimatedItemSize={150}
          contentContainerStyle={styles.grid}
          keyExtractor={g => g.key}
          renderItem={({ item }) => {
            const owned = item.cards.some(c => ownedAll.has(c.id));
            return (
              <Pressable style={styles.tile} onPress={() => setSelectedCharacter(item.key)}>
                <Image
                  source={{ uri: item.cards[0].image_small }}
                  style={[styles.tileImg, !owned && styles.tileImgMissing]}
                  resizeMode="contain"
                />
                <Text style={[styles.tileName, !owned && styles.tileNameMissing]} numberOfLines={1}>{item.key}</Text>
                <Text style={styles.tileCount}>{item.cards.length} carte{item.cards.length > 1 ? 's' : ''}</Text>
              </Pressable>
            );
          }}
        />
      )}
      {!selectedCharacter && (
        <View style={styles.searchOverlay} pointerEvents="box-none">
          {searchOpen && (
            <View style={styles.floatingSearch}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Chercher un dresseur"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoFocus
                style={styles.floatingSearchInput}
                onBlur={() => { if (!search) setSearchOpen(false); }}
              />
              <Pressable onPress={() => { setSearch(''); setSearchOpen(false); }} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => setSearchOpen(o => !o)} style={styles.searchFab}>
            <Ionicons name="search" size={22} color={search ? colors.primary : colors.text} />
          </Pressable>
        </View>
      )}
      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
    </SafeAreaView>
  );
}
