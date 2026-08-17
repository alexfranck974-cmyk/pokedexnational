import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image, StyleSheet, FlatList, ScrollView, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useSession } from '@/lib/auth';
import {
  useUserDex, useOwnedCardImages, useAllOwnedCardIds, useAllOwnedCardsDetailed,
  useAllOwnedCardsLedgerDetailed, useOwnedCardQuantities,
} from '@/lib/collection';
import { eurFormatter } from '@/lib/trades';
import { useFavorites, useToggleFavorite, useShowcase, useToggleShowcase } from '@/lib/favorites';
import { toast } from '@/lib/toast';
import { enterPokemonDetail, withReturnTo } from '@/lib/navigation';
import {
  useTeams, useCreateTeam, useRenameTeam, useDeleteTeam, useSetTeamSlot, useClearTeamSlot,
} from '@/lib/teams';
import {
  useBinders, useCreateBinder, useRenameBinder, useDeleteBinder,
  useBinderCards, useRemoveBinderSlot, useSetBinderLayout,
  BINDER_LAYOUTS, BINDER_LAYOUT_COLS, type BinderLayout,
} from '@/lib/binders';
import { useSetGoals, useToggleSetGoal } from '@/lib/collection-goals';
import { useTcgSets } from '@/lib/tcg-index';
import { FavoriteTile } from '@/components/FavoriteTile';
import { Pokeball } from '@/components/Pokeball';
import { BubbleSheet } from '@/components/BubbleSheet';
import { TeamSlotPicker } from '@/components/TeamSlotPicker';
import { BinderSlotPicker } from '@/components/BinderSlotPicker';
import { SetGoalTile } from '@/components/SetGoalTile';
import { SetGoalPicker } from '@/components/SetGoalPicker';
import { TrainersPanel } from '@/components/TrainersPanel';
import { CardZoomModal, type ZoomableCard } from '@/components/CardZoomModal';
import { FavoritesFilterBar } from '@/components/FavoritesFilterBar';
import { PokedexSectionTabs } from '@/components/PokedexSectionTabs';
import { ConfirmDialog, type ConfirmTarget } from '@/components/ConfirmDialog';
import { RefreshButton } from '@/components/RefreshButton';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import { setFlagLabel } from '@/lib/tcg-set-labels';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));
const TEAM_SIZE = 6;
const VITRINE_LIMIT = 6;
const BINDER_LAYOUT_LABEL: Record<BinderLayout, string> = { 1: '1 carte / page', 4: '2 × 2', 9: '3 × 3', 12: '4 × 3', 16: '4 × 4' };

export type FavStatusFilter = 'all' | 'favorites' | 'vitrine';
export type FavSortKey = 'fav-recent' | 'num-asc' | 'num-desc' | 'name-asc' | 'name-desc';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const chipStyles = useThemedStyles((colors) => ({
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    active: { backgroundColor: colors.primary },
    text: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    textActive: { color: 'white' },
  }));
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.active]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </Pressable>
  );
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: ownedCardsDetailed = [] } = useAllOwnedCardsDetailed(userId);
  const artistByDex = useMemo(() => new Map(ownedCardsDetailed.map(c => [c.dexNum, c.artist])), [ownedCardsDetailed]);
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: favorites = new Set<number>() } = useFavorites(userId);
  const toggleFavorite = useToggleFavorite();
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const toggleShowcase = useToggleShowcase();

  const { data: teams = [] } = useTeams(userId);
  const createTeam = useCreateTeam();
  const renameTeam = useRenameTeam();
  const deleteTeam = useDeleteTeam();
  const setSlot = useSetTeamSlot();
  const clearSlot = useClearTeamSlot();

  const { data: binders = [] } = useBinders(userId);
  const createBinder = useCreateBinder();
  const renameBinder = useRenameBinder();
  const deleteBinder = useDeleteBinder();
  const removeBinderSlot = useRemoveBinderSlot();
  const setBinderLayout = useSetBinderLayout();

  const { data: goals = [] } = useSetGoals(userId);
  const toggleGoal = useToggleSetGoal();
  const { data: allSets = [] } = useTcgSets();
  const setsById = useMemo(() => new Map(allSets.map(s => [s.id, s])), [allSets]);
  const pinnedSetIds = useMemo(() => new Set(goals.map(g => g.setId)), [goals]);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);

  const [subTab, setSubTab] = useState<'favorites' | 'teams' | 'binders' | 'goals' | 'trainers' | 'duplicates'>('favorites');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null);
  const [newBinderName, setNewBinderName] = useState('');
  const [binderRenaming, setBinderRenaming] = useState(false);
  const [binderRenameValue, setBinderRenameValue] = useState('');
  const [pickingPosition, setPickingPosition] = useState<number | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'team' | 'binder' | 'setGoal'; id: string; name: string } | null>(null);

  const [favSearch, setFavSearch] = useState('');
  const [favStatusFilter, setFavStatusFilter] = useState<FavStatusFilter>('all');
  const [favSort, setFavSort] = useState<FavSortKey>('num-asc');

  const [dupSearch, setDupSearch] = useState('');
  const [dupSort, setDupSort] = useState<'value' | 'quantity' | 'name'>('value');
  const [dupZoom, setDupZoom] = useState<ZoomableCard | null>(null);

  const ownedPokemon = useMemo(() => POKEDEX.filter(p => owned.has(p.num)), [owned]);

  // Set iteration order already reflects favorited_at desc (see lib/favorites.ts),
  // so its index doubles as a "most recently favorited first" rank.
  const favoriteRecency = useMemo(() => new Map(Array.from(favorites).map((d, i) => [d, i])), [favorites]);

  // Debounced: search can shrink this FlashList (numColumns > 1) drastically
  // on every keystroke — see lib/use-debounced-value.ts for why that's unsafe.
  const debouncedFavSearch = useDebouncedValue(favSearch, 200);
  const visibleFavoritePokemon = useMemo(() => {
    const q = normalize(debouncedFavSearch.trim());
    let list = ownedPokemon.filter(p => {
      if (q) {
        const artist = artistByDex.get(p.num);
        const nameMatch = normalize(getName(p)).includes(q);
        const numMatch = String(p.num).includes(q);
        const artistMatch = !!artist && normalize(artist).includes(q);
        if (!nameMatch && !numMatch && !artistMatch) return false;
      }
      if (favStatusFilter === 'favorites' && !favorites.has(p.num)) return false;
      if (favStatusFilter === 'vitrine' && !showcase.has(p.num)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (favSort) {
        case 'name-asc': return getName(a).localeCompare(getName(b));
        case 'name-desc': return getName(b).localeCompare(getName(a));
        case 'num-desc': return b.num - a.num;
        case 'fav-recent': {
          const ra = favoriteRecency.get(a.num) ?? Infinity;
          const rb = favoriteRecency.get(b.num) ?? Infinity;
          return ra !== rb ? ra - rb : a.num - b.num;
        }
        case 'num-asc':
        default: return a.num - b.num;
      }
    });
    return list;
  }, [ownedPokemon, debouncedFavSearch, favStatusFilter, favSort, favorites, showcase, favoriteRecency, artistByDex]);

  // Debounced for the same reason as favSearch above.
  const debouncedDupSearch = useDebouncedValue(dupSearch, 200);
  const duplicateCards = useMemo(() => {
    const q = normalize(debouncedDupSearch.trim());
    let list = ledgerCards.filter(c => {
      if ((quantities.get(c.cardId) ?? 0) < 2) return false;
      if (q && !normalize(c.name).includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (dupSort) {
        case 'quantity': return (quantities.get(b.cardId) ?? 0) - (quantities.get(a.cardId) ?? 0);
        case 'name': return a.name.localeCompare(b.name);
        case 'value':
        default: return (b.cardmarketTrendEur ?? 0) - (a.cardmarketTrendEur ?? 0);
      }
    });
    return list;
  }, [ledgerCards, quantities, debouncedDupSearch, dupSort]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null;
  const selectedBinder = binders.find(b => b.id === selectedBinderId) ?? null;
  const { data: binderCards = [] } = useBinderCards(selectedBinderId ?? undefined);
  const binderCardIds = useMemo(() => new Set(binderCards.filter(c => c.cardId).map(c => c.cardId as string)), [binderCards]);
  const binderCardsByPosition = useMemo(() => new Map(binderCards.map(c => [c.position, c])), [binderCards]);
  // Always render at least one full trailing page of empty slots past the
  // highest filled position (not just the card count — removing a card from
  // the middle leaves a gap, so count alone would under-allocate).
  const binderSlotCount = useMemo(() => {
    if (!selectedBinder) return 0;
    const layout = selectedBinder.layout;
    const maxPosition = binderCards.reduce((max, c) => Math.max(max, c.position), -1);
    const usedPages = Math.ceil((maxPosition + 1) / layout);
    return (usedPages + 1) * layout;
  }, [selectedBinder, binderCards]);

  const pickerOptions = useMemo(() => {
    if (!selectedTeam) return [];
    const used = new Set(selectedTeam.slots.map(s => s.dexNum));
    return ownedPokemon
      .filter(p => !used.has(p.num))
      .map(p => ({ pokemon: p, cardImage: ownedImages.get(p.num) }));
  }, [selectedTeam, ownedPokemon, ownedImages]);

  const handleToggleShowcase = (dexNum: number) => {
    const currentlyInShowcase = showcase.has(dexNum);
    if (!currentlyInShowcase && showcase.size >= VITRINE_LIMIT) {
      toast(`Vitrine limitée à ${VITRINE_LIMIT} cartes — retire-en une avant d’en ajouter une autre.`);
      return;
    }
    toggleShowcase.mutate({ dexNum, currentlyFavorited: favorites.has(dexNum), currentlyInShowcase });
  };

  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    const id = await createTeam.mutateAsync(name);
    setNewTeamName('');
    setSelectedTeamId(id);
  };

  const handleCreateBinder = async () => {
    const name = newBinderName.trim();
    if (!name) return;
    const id = await createBinder.mutateAsync(name);
    setNewBinderName('');
    setSelectedBinderId(id);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'team') {
      deleteTeam.mutate(deleteTarget.id);
      if (selectedTeamId === deleteTarget.id) setSelectedTeamId(null);
    } else if (deleteTarget.kind === 'binder') {
      deleteBinder.mutate(deleteTarget.id);
      if (selectedBinderId === deleteTarget.id) setSelectedBinderId(null);
    } else {
      toggleGoal.mutate({ setId: deleteTarget.id, currentlyPinned: true });
    }
    setDeleteTarget(null);
  };

  const confirmTarget: ConfirmTarget | null = deleteTarget
    ? {
        title: deleteTarget.kind === 'team' ? 'Supprimer l’équipe' : deleteTarget.kind === 'binder' ? 'Supprimer le binder' : 'Retirer cet objectif ?',
        message: deleteTarget.kind === 'setGoal' ? `${deleteTarget.name} ne sera plus suivie comme objectif de complétion.` : `Supprimer "${deleteTarget.name}" ?`,
      }
    : null;

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.sm },
    header: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm, ...shadow.sm },
    titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    title: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
    chipRow: { flexDirection: 'row' as const, gap: spacing.xs },
    legend: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim },
    emptyTitle: { fontSize: 18, fontFamily: fonts.display, textAlign: 'center' as const, color: colors.text },
    emptyHint: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const },

    teamList: { flex: 1, padding: spacing.md, gap: spacing.md },
    newTeamRow: { flexDirection: 'row' as const, gap: spacing.sm },
    newTeamInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, fontFamily: fonts.body, backgroundColor: colors.surfaceAlt, color: colors.text },
    newTeamBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
    teamRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.md,
      backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow.sm,
    },
    teamRowPressed: { backgroundColor: colors.surfaceAlt },
    teamRowName: { flex: 1, fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text },
    teamRowCount: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },

    teamEditor: { flex: 1, padding: spacing.md, gap: spacing.md },
    teamEditorHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    teamEditorTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
    renameInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 8, fontSize: 16, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },

    slotGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    slot: {
      width: '31%' as const, aspectRatio: 0.85, backgroundColor: colors.surface, borderRadius: radius.bubble,
      alignItems: 'center' as const, justifyContent: 'center' as const, padding: spacing.xs, ...shadow.sm, position: 'relative' as const,
    },
    slotSprite: { width: '80%' as const, height: '60%' as const },
    slotName: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const, marginTop: 2 },
    slotClear: { position: 'absolute' as const, top: 2, right: 2 },
    slotEmpty: {
      width: '100%' as const, height: '100%' as const, borderRadius: radius.bubble, borderWidth: 2, borderStyle: 'dashed' as const,
      borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
    },

    addCardsBtn: {
      flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm,
    },
    addCardsBtnText: { color: 'white', fontFamily: fonts.bodyBold, fontSize: 14 },
    collectionTile: { flex: 1, padding: 6 },
    collectionImgWrap: { position: 'relative' as const },
    holoBorder: { borderRadius: radius.bubble, padding: 2 },
    holoInner: { borderRadius: radius.bubble - 2, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    plainInner: { borderRadius: radius.bubble, overflow: 'hidden' as const, backgroundColor: colors.surfaceAlt },
    collectionImg: { width: '100%' as const, aspectRatio: 0.72 },
    removeBtn: {
      position: 'absolute' as const, top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    notOwnedBadge: {
      position: 'absolute' as const, top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    binderSlotTile: { flex: 1, padding: 6, aspectRatio: 0.72 },
    binderSlotEmpty: {
      flex: 1, borderRadius: radius.bubble, borderWidth: 2, borderStyle: 'dashed' as const,
      borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surfaceAlt,
    },
    layoutOptions: { padding: spacing.md, gap: spacing.sm },
    layoutOption: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
    layoutOptionActive: { backgroundColor: colors.primary },
    layoutOptionText: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const },
    layoutOptionTextActive: { color: 'white' },
    goalsGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, paddingBottom: TAB_BAR_CLEARANCE },

    dupHeader: { padding: spacing.md, gap: spacing.sm },
    dupSearchInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10,
      fontSize: 14, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    dupChipRow: { flexDirection: 'row' as const, gap: spacing.sm },
    dupTile: { flex: 1, padding: 6, alignItems: 'center' as const },
    dupImgWrap: { position: 'relative' as const, width: '100%' as const },
    dupImg: { width: '100%' as const, aspectRatio: 0.72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
    dupQtyBadge: {
      position: 'absolute' as const, top: 4, right: 4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
      backgroundColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    dupQtyText: { fontSize: 11, fontFamily: fonts.bodyBold, color: 'white' },
    dupValueText: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.success, marginTop: 4 },
    dupName: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const, marginTop: 1 },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <PokedexSectionTabs active="collection" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {subTab === 'favorites' ? 'Favoris'
              : subTab === 'teams' ? 'Équipes'
              : subTab === 'binders' ? 'Mes binders'
              : subTab === 'trainers' ? 'Dresseurs'
              : subTab === 'duplicates' ? 'Doublons'
              : 'Extensions'}
          </Text>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="Extensions" active={subTab === 'goals'} onPress={() => setSubTab('goals')} />
          <Chip label="Dresseurs" active={subTab === 'trainers'} onPress={() => setSubTab('trainers')} />
          <Chip label="Favoris" active={subTab === 'favorites'} onPress={() => setSubTab('favorites')} />
          <Chip label="Mes binders" active={subTab === 'binders'} onPress={() => setSubTab('binders')} />
          <Chip label="Doublons" active={subTab === 'duplicates'} onPress={() => setSubTab('duplicates')} />
          {/* "Équipes" is intentionally not surfaced for now — kept dormant (state/branch
              still below) for a possible future deckbuilding feature, not deleted. */}
        </ScrollView>
        {subTab === 'favorites' && (
          <Text style={styles.legend}>
            ★ Favori · ✨ Vitrine (max {VITRINE_LIMIT}) — mise en avant sur ton Dashboard et ton profil public
          </Text>
        )}
      </View>

      {subTab === 'favorites' ? (
        ownedPokemon.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Aucun Pokémon possédé</Text>
            <Text style={styles.emptyHint}>Ajoute des cartes depuis le Pokédex pour pouvoir les mettre en favoris.</Text>
          </View>
        ) : (
          <>
            {visibleFavoritePokemon.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyHint}>Aucun résultat avec ces filtres.</Text>
              </View>
            ) : (
              <FlashList
                data={visibleFavoritePokemon}
                numColumns={numColsFor(width)}
                estimatedItemSize={120}
                contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
                maintainVisibleContentPosition={{ disabled: true }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
                {...hideOnScrollProps}
                keyExtractor={p => String(p.num)}
                renderItem={({ item }) => !item ? null : (
                  <FavoriteTile
                    pokemon={item}
                    cardImage={ownedImages.get(item.num)}
                    favorited={favorites.has(item.num)}
                    inShowcase={showcase.has(item.num)}
                    onPress={() => enterPokemonDetail(router, `/pokemon/${item.num}`, '/favorites')}
                    onToggleFavorite={() => toggleFavorite.mutate({ dexNum: item.num, currentlyFavorited: favorites.has(item.num) })}
                    onToggleShowcase={() => handleToggleShowcase(item.num)}
                  />
                )}
              />
            )}
            <FavoritesFilterBar
              search={favSearch} onSearch={setFavSearch}
              statusFilter={favStatusFilter} onStatus={setFavStatusFilter}
              sort={favSort} onSort={setFavSort}
            />
          </>
        )
      ) : subTab === 'teams' ? (
        selectedTeam ? (
          <View style={styles.teamEditor}>
            <View style={styles.teamEditorHeader}>
              <Pressable onPress={() => { setSelectedTeamId(null); setRenaming(false); }} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
              </Pressable>
              {renaming ? (
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  style={styles.renameInput}
                  onSubmitEditing={() => { renameTeam.mutate({ teamId: selectedTeam.id, name: renameValue.trim() || selectedTeam.name }); setRenaming(false); }}
                  onBlur={() => { renameTeam.mutate({ teamId: selectedTeam.id, name: renameValue.trim() || selectedTeam.name }); setRenaming(false); }}
                />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => { setRenameValue(selectedTeam.name); setRenaming(true); }}>
                  <Text style={styles.teamEditorTitle} numberOfLines={1}>{selectedTeam.name}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setDeleteTarget({ kind: 'team', id: selectedTeam.id, name: selectedTeam.name })} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            <View style={styles.slotGrid}>
              {Array.from({ length: TEAM_SIZE }, (_, i) => i).map(slotIndex => {
                const slot = selectedTeam.slots.find(s => s.slotIndex === slotIndex);
                const mon = slot ? POKEDEX_BY_DEX.get(slot.dexNum) : undefined;
                return (
                  <Pressable key={slotIndex} onPress={() => setPickerSlot(slotIndex)} style={styles.slot}>
                    {mon ? (
                      <>
                        <Image source={{ uri: ownedImages.get(mon.num) ?? mon.sprite_url }} style={styles.slotSprite} resizeMode="contain" />
                        <Text style={styles.slotName} numberOfLines={1}>{getName(mon)}</Text>
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => { e.stopPropagation(); clearSlot.mutate({ teamId: selectedTeam.id, slotIndex }); }}
                          style={styles.slotClear}>
                          <Ionicons name="close-circle" size={18} color={colors.danger} />
                        </Pressable>
                      </>
                    ) : (
                      <View style={styles.slotEmpty}>
                        <Ionicons name="add" size={22} color={colors.textDim} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.teamList}>
            <View style={styles.newTeamRow}>
              <TextInput
                placeholder="Nom de la nouvelle équipe"
                value={newTeamName}
                onChangeText={setNewTeamName}
                onSubmitEditing={handleCreateTeam}
                style={styles.newTeamInput}
              />
              <Pressable onPress={handleCreateTeam} style={styles.newTeamBtn}>
                <Ionicons name="add" size={20} color="white" />
              </Pressable>
            </View>

            {teams.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyHint}>Aucune équipe pour l’instant — crée-en une ci-dessus.</Text>
              </View>
            ) : (
              <FlatList
                data={teams}
                contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
                {...hideOnScrollProps}
                keyExtractor={t => t.id}
                renderItem={({ item }) => (
                  <Pressable onPress={() => setSelectedTeamId(item.id)} style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
                    <Text style={styles.teamRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.teamRowCount}>{item.slots.length}/{TEAM_SIZE}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </View>
        )
      ) : subTab === 'binders' ? (
        selectedBinder ? (
        <View style={styles.teamEditor}>
          <View style={styles.teamEditorHeader}>
            <Pressable onPress={() => { setSelectedBinderId(null); setBinderRenaming(false); }} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            {binderRenaming ? (
              <TextInput
                value={binderRenameValue}
                onChangeText={setBinderRenameValue}
                autoFocus
                style={styles.renameInput}
                onSubmitEditing={() => { renameBinder.mutate({ binderId: selectedBinder.id, name: binderRenameValue.trim() || selectedBinder.name }); setBinderRenaming(false); }}
                onBlur={() => { renameBinder.mutate({ binderId: selectedBinder.id, name: binderRenameValue.trim() || selectedBinder.name }); setBinderRenaming(false); }}
              />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={() => { setBinderRenameValue(selectedBinder.name); setBinderRenaming(true); }}>
                <Text style={styles.teamEditorTitle} numberOfLines={1}>{selectedBinder.name}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setLayoutPickerOpen(true)} hitSlop={8} style={{ marginRight: spacing.sm }}>
              <Ionicons name="grid-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => setDeleteTarget({ kind: 'binder', id: selectedBinder.id, name: selectedBinder.name })} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>

          <FlashList
            data={Array.from({ length: binderSlotCount }, (_, position) => binderCardsByPosition.get(position) ?? { position })}
            numColumns={BINDER_LAYOUT_COLS[selectedBinder.layout]}
            estimatedItemSize={200}
            contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
            maintainVisibleContentPosition={{ disabled: true }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            {...hideOnScrollProps}
            keyExtractor={(s) => String(s.position)}
            renderItem={({ item }) => {
              const filled = 'cardId' in item;
              if (!filled) {
                return (
                  <View style={styles.binderSlotTile}>
                    <Pressable onPress={() => setPickingPosition(item.position)} style={styles.binderSlotEmpty}>
                      <Ionicons name="add" size={28} color={colors.textDim} />
                    </Pressable>
                  </View>
                );
              }
              const isCard = item.kind === 'card';
              const isOwned = isCard && ownedCardIds.has(item.cardId as string);
              return (
                <View style={styles.binderSlotTile}>
                  <View style={styles.collectionImgWrap}>
                    {isOwned ? (
                      <LinearGradient
                        colors={[colors.primary, colors.warning, colors.primary]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.holoBorder}>
                        <View style={styles.holoInner}>
                          <Image source={{ uri: item.imageUrl }} style={styles.collectionImg} resizeMode="contain" />
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={styles.plainInner}>
                        <Image source={{ uri: item.imageUrl }} style={styles.collectionImg} resizeMode={isCard ? 'contain' : 'cover'} />
                      </View>
                    )}
                    {isCard && !isOwned && (
                      <View style={styles.notOwnedBadge}>
                        <Pokeball size={16} muted />
                      </View>
                    )}
                    <Pressable
                      hitSlop={8}
                      onPress={() => removeBinderSlot.mutate({ binderId: selectedBinder.id, position: item.position, imagePath: item.imagePath })}
                      style={styles.removeBtn}>
                      <Ionicons name="close" size={16} color="white" />
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        </View>
      ) : (
        <View style={styles.teamList}>
          <View style={styles.newTeamRow}>
            <TextInput
              placeholder="Nom du nouveau binder"
              value={newBinderName}
              onChangeText={setNewBinderName}
              onSubmitEditing={handleCreateBinder}
              style={styles.newTeamInput}
            />
            <Pressable onPress={handleCreateBinder} style={styles.newTeamBtn}>
              <Ionicons name="add" size={20} color="white" />
            </Pressable>
          </View>

          {binders.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>Aucun binder pour l’instant — crée-en un ci-dessus.</Text>
            </View>
          ) : (
            <FlatList
              data={binders}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              {...hideOnScrollProps}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => setSelectedBinderId(item.id)} style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
                  <Text style={styles.teamRowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.teamRowCount}>{item.itemCount} carte{item.itemCount > 1 ? 's' : ''}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
        )
      ) : subTab === 'trainers' ? (
        <TrainersPanel
          userId={userId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      ) : subTab === 'duplicates' ? (
        <>
          <View style={styles.dupHeader}>
            <TextInput
              placeholder="Chercher une carte"
              value={dupSearch}
              onChangeText={setDupSearch}
              style={styles.dupSearchInput}
            />
            <View style={styles.dupChipRow}>
              <Chip label="Valeur" active={dupSort === 'value'} onPress={() => setDupSort('value')} />
              <Chip label="Quantité" active={dupSort === 'quantity'} onPress={() => setDupSort('quantity')} />
              <Chip label="A-Z" active={dupSort === 'name'} onPress={() => setDupSort('name')} />
            </View>
          </View>
          {duplicateCards.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>
                {dupSearch.trim() ? 'Aucun résultat.' : 'Aucun doublon pour l’instant — un doublon apparaît ici dès qu’une carte passe à 2 exemplaires ou plus.'}
              </Text>
            </View>
          ) : (
            <FlashList
              data={duplicateCards}
              numColumns={numColsFor(width)}
              estimatedItemSize={150}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              maintainVisibleContentPosition={{ disabled: true }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              {...hideOnScrollProps}
              keyExtractor={c => c.cardId}
              renderItem={({ item }) => {
                if (!item) return null;
                const qty = quantities.get(item.cardId) ?? 0;
                return (
                  <Pressable
                    style={styles.dupTile}
                    onPress={() => setDupZoom({ image_small: item.imageSmall, image_large: item.imageLarge })}>
                    <View style={styles.dupImgWrap}>
                      <Image source={{ uri: item.imageSmall }} style={styles.dupImg} resizeMode="contain" />
                      <View style={styles.dupQtyBadge}>
                        <Text style={styles.dupQtyText}>×{qty}</Text>
                      </View>
                    </View>
                    {item.cardmarketTrendEur != null && (
                      <Text style={styles.dupValueText}>{eurFormatter.format(item.cardmarketTrendEur)}</Text>
                    )}
                    <Text style={styles.dupName} numberOfLines={1}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      ) : (
        <View style={styles.teamList}>
          <Pressable onPress={() => setGoalPickerOpen(true)} style={styles.addCardsBtn}>
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.addCardsBtnText}>Épingler une extension</Text>
          </Pressable>

          {goals.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>Aucune extension épinglée pour l’instant.</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.goalsGrid}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              {...hideOnScrollProps}>
              {goals.map(g => {
                const set = setsById.get(g.setId);
                if (!set) return null;
                const setName = setFlagLabel(set.name, set.region);
                return (
                  <SetGoalTile
                    key={g.setId}
                    userId={userId}
                    setId={g.setId}
                    setName={setName}
                    total={set.cardCount}
                    symbol={set.symbol}
                    onPress={() => router.push(withReturnTo(`/pinned-set/${g.setId}`, '/favorites') as never)}
                    onUnpin={() => setDeleteTarget({ kind: 'setGoal', id: g.setId, name: setName })}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      <TeamSlotPicker
        visible={pickerSlot !== null}
        options={pickerOptions}
        onSelect={(dexNum) => {
          if (selectedTeam && pickerSlot !== null) {
            setSlot.mutate({ teamId: selectedTeam.id, slotIndex: pickerSlot, dexNum });
          }
          setPickerSlot(null);
        }}
        onClose={() => setPickerSlot(null)}
      />

      <BinderSlotPicker
        visible={pickingPosition !== null}
        binderId={selectedBinderId}
        position={pickingPosition}
        cardIdsInBinder={binderCardIds}
        onClose={() => setPickingPosition(null)}
      />

      <BubbleSheet visible={layoutPickerOpen} onClose={() => setLayoutPickerOpen(false)} tint={colors.primary} title="Mise en page" sizing="auto">
        <View style={styles.layoutOptions}>
          {BINDER_LAYOUTS.map((l) => (
            <Pressable
              key={l}
              onPress={() => {
                if (selectedBinder) setBinderLayout.mutate({ binderId: selectedBinder.id, layout: l });
                setLayoutPickerOpen(false);
              }}
              style={[styles.layoutOption, selectedBinder?.layout === l && styles.layoutOptionActive]}>
              <Text style={[styles.layoutOptionText, selectedBinder?.layout === l && styles.layoutOptionTextActive]}>
                {BINDER_LAYOUT_LABEL[l]}
              </Text>
            </Pressable>
          ))}
        </View>
      </BubbleSheet>

      <SetGoalPicker
        visible={goalPickerOpen}
        pinnedSetIds={pinnedSetIds}
        tint="#38bdf8"
        onClose={() => setGoalPickerOpen(false)}
      />

      <ConfirmDialog
        target={confirmTarget}
        confirmLabel={deleteTarget?.kind === 'setGoal' ? 'Désépingler' : 'Supprimer'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <CardZoomModal card={dupZoom} onClose={() => setDupZoom(null)} />
    </SafeAreaView>
  );
}
