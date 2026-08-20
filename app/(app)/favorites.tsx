import { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image, StyleSheet, FlatList, ScrollView, RefreshControl, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { withReturnTo } from '@/lib/navigation';
import {
  useTeams, useCreateTeam, useRenameTeam, useDeleteTeam, useSetTeamSlot, useClearTeamSlot,
} from '@/lib/teams';
import {
  useBinders, useCreateBinder, useRenameBinder, useDeleteBinder,
  useBinderCards, useRemoveBinderSlot, useSetBinderLayout, useSwapBinderSlots,
  BINDER_LAYOUTS, BINDER_LAYOUT_COLS, type BinderLayout,
} from '@/lib/binders';
import { useSetGoals, useToggleSetGoal } from '@/lib/collection-goals';
import { useTcgSets, useTcgArtists } from '@/lib/tcg-index';
import { Pokeball } from '@/components/Pokeball';
import { BubbleSheet } from '@/components/BubbleSheet';
import { TeamSlotPicker } from '@/components/TeamSlotPicker';
import { BinderSlotPicker } from '@/components/BinderSlotPicker';
import { SetGoalTile } from '@/components/SetGoalTile';
import { TrainersPanel } from '@/components/TrainersPanel';
import { BackButton } from '@/components/BackButton';
import { CardZoomModal, type ZoomableCard } from '@/components/CardZoomModal';
import { PokedexSectionTabs } from '@/components/PokedexSectionTabs';
import { ConfirmDialog, type ConfirmTarget } from '@/components/ConfirmDialog';
import { RefreshButton } from '@/components/RefreshButton';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useLocale, useT } from '@/lib/locale';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import { setFlagLabel } from '@/lib/tcg-set-labels';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));
const TEAM_SIZE = 6;

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
  const { locale } = useLocale();
  const t = useT();
  const BINDER_LAYOUT_LABEL: Record<BinderLayout, string> = {
    1: t('favorites.layoutOnePerPage'), 4: '2 × 2', 9: '3 × 3', 12: '4 × 3', 16: '4 × 4',
  };
  const REGION_ORDER: { id: string; label: string }[] = [
    { id: 'global', label: 'Global' },
    { id: 'jp', label: t('favorites.regionJapan') },
    { id: 'cn', label: t('favorites.regionChina') },
  ];
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: ownedCardsDetailed = [] } = useAllOwnedCardsDetailed(userId);
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);

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
  const swapBinderSlots = useSwapBinderSlots();

  const { data: goals = [] } = useSetGoals(userId);
  const toggleGoal = useToggleSetGoal();
  const { data: allSets = [] } = useTcgSets();
  const setsById = useMemo(() => new Map(allSets.map(s => [s.id, s])), [allSets]);
  const pinnedSetIds = useMemo(() => new Set(goals.map(g => g.setId)), [goals]);
  // Unpinned sets, grouped by region and kept in useTcgSets()'s own release-date-desc
  // order within each group — no stats shown here, that's what pinning unlocks.
  const catalogGroups = useMemo(() => {
    return REGION_ORDER
      .map(r => ({ ...r, sets: allSets.filter(s => (s.region || 'global') === r.id && !pinnedSetIds.has(s.id)) }))
      .filter(g => g.sets.length > 0);
  }, [allSets, pinnedSetIds, locale]);

  const { data: allArtists = [] } = useTcgArtists();
  // Owned count per artist — computed client-side from cards already fetched
  // (no per-artist query needed, unlike per-set progress).
  const ownedCountByArtist = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of ownedCardsDetailed) {
      if (!c.artist) continue;
      map.set(c.artist, (map.get(c.artist) ?? 0) + 1);
    }
    return map;
  }, [ownedCardsDetailed]);

  const [subTab, setSubTab] = useState<'teams' | 'binders' | 'goals' | 'artists' | 'trainers' | 'duplicates'>('goals');
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

  // Drag-and-drop state for binder slots — see swap_binder_slots RPC (050) for
  // the DB side. draggingPosition/dragTranslation drive the floating ghost
  // visual, hoverPosition drives the drop-target ring. The *Ref twins mirror
  // the state synchronously (refs update instantly, state waits for the next
  // render) so the gesture callbacks — which can fire many times between
  // renders — always gate and commit against the current value, not a stale one.
  const [draggingPosition, setDraggingPosition] = useState<number | null>(null);
  const [dragTranslation, setDragTranslation] = useState({ x: 0, y: 0 });
  const [dragStartAbsolute, setDragStartAbsolute] = useState({ x: 0, y: 0 });
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const activeDragPositionRef = useRef<number | null>(null);
  const hoverPositionRef = useRef<number | null>(null);
  const gridContainerRef = useRef<View>(null);
  const gridOriginRef = useRef({ x: 0, y: 0 });
  const scrollYRef = useRef(0);
  const tileSizeRef = useRef({ width: 0, height: 0 });
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'team' | 'binder' | 'setGoal'; id: string; name: string } | null>(null);

  const [artistSearch, setArtistSearch] = useState('');
  const [dupSearch, setDupSearch] = useState('');
  const [dupSort, setDupSort] = useState<'value' | 'quantity' | 'name'>('value');
  const [dupZoom, setDupZoom] = useState<ZoomableCard | null>(null);
  const [binderZoom, setBinderZoom] = useState<ZoomableCard | null>(null);

  const ownedPokemon = useMemo(() => POKEDEX.filter(p => owned.has(p.num)), [owned]);

  const debouncedArtistSearch = useDebouncedValue(artistSearch, 200);
  const filteredArtists = useMemo(() => {
    const q = normalize(debouncedArtistSearch.trim());
    return q ? allArtists.filter(a => normalize(a.artist).includes(q)) : allArtists;
  }, [allArtists, debouncedArtistSearch]);

  // Debounced: search can shrink this FlashList drastically on every keystroke.
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

  // Long-press-then-drag gesture for one occupied binder slot. Hit-testing is
  // done by grid geometry (origin + scroll offset + measured tile size), not
  // by measuring every tile — FlashList recycles views, so per-tile layout
  // tracking would be unreliable across scroll. On release, swaps (or moves,
  // if the target is empty) the dragged slot with whatever's under the finger.
  const buildSlotDragGesture = (position: number) => {
    const longPress = Gesture.LongPress()
      .minDuration(250)
      .onStart((e) => {
        activeDragPositionRef.current = position;
        hoverPositionRef.current = position;
        setDraggingPosition(position);
        setHoverPosition(position);
        setDragStartAbsolute({ x: e.absoluteX, y: e.absoluteY });
        setDragTranslation({ x: 0, y: 0 });
      });

    const pan = Gesture.Pan()
      .minDistance(10)
      .onUpdate((e) => {
        if (activeDragPositionRef.current !== position || !selectedBinder) return;
        setDragTranslation({ x: e.translationX, y: e.translationY });
        const { width: tw, height: th } = tileSizeRef.current;
        if (tw <= 0 || th <= 0) return;
        const numCols = BINDER_LAYOUT_COLS[selectedBinder.layout];
        const col = Math.floor((e.absoluteX - gridOriginRef.current.x) / tw);
        const row = Math.floor((e.absoluteY - gridOriginRef.current.y + scrollYRef.current) / th);
        const target = Math.max(0, Math.min(binderSlotCount - 1, row * numCols + col));
        hoverPositionRef.current = target;
        setHoverPosition(target);
      })
      .onEnd(() => {
        if (activeDragPositionRef.current === position && selectedBinder) {
          const target = hoverPositionRef.current;
          if (target != null && target !== position) {
            swapBinderSlots.mutate({ binderId: selectedBinder.id, positionA: position, positionB: target });
          }
        }
        activeDragPositionRef.current = null;
        hoverPositionRef.current = null;
        setDraggingPosition(null);
        setHoverPosition(null);
        setDragTranslation({ x: 0, y: 0 });
      });

    return Gesture.Simultaneous(longPress, pan);
  };

  const onGridLayout = (_e: LayoutChangeEvent) => {
    gridContainerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      gridOriginRef.current = { x: pageX, y: pageY };
    });
  };

  const onGridScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const onTileLayout = (e: LayoutChangeEvent) => {
    if (tileSizeRef.current.width > 0) return;
    const { width, height } = e.nativeEvent.layout;
    tileSizeRef.current = { width, height };
  };

  const draggedItem = draggingPosition != null ? binderCardsByPosition.get(draggingPosition) : undefined;

  const pickerOptions = useMemo(() => {
    if (!selectedTeam) return [];
    const used = new Set(selectedTeam.slots.map(s => s.dexNum));
    return ownedPokemon
      .filter(p => !used.has(p.num))
      .map(p => ({ pokemon: p, cardImage: ownedImages.get(p.num) }));
  }, [selectedTeam, ownedPokemon, ownedImages]);

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
        title: deleteTarget.kind === 'team' ? 'Supprimer l’équipe' : deleteTarget.kind === 'binder' ? t('favorites.deleteBinderTitle') : t('dashboard.unpinTitle'),
        message: deleteTarget.kind === 'setGoal' ? t('dashboard.unpinMessage', { name: deleteTarget.name }) : t('favorites.deleteConfirmMessage', { name: deleteTarget.name }),
      }
    : null;

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.sm },
    header: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm, ...shadow.sm },
    titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    title: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
    chipRow: { flexDirection: 'row' as const, gap: spacing.xs },
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
    zoomBtn: {
      position: 'absolute' as const, top: 4, left: 4, width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    notOwnedBadge: {
      position: 'absolute' as const, top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    binderSlotTile: { flex: 1, padding: 6, aspectRatio: 0.72 },
    binderSlotDragging: { opacity: 0.35 },
    binderSlotHover: { borderRadius: radius.bubble, borderWidth: 2, borderColor: colors.primary },
    binderSlotEmpty: {
      flex: 1, borderRadius: radius.bubble, borderWidth: 2, borderStyle: 'dashed' as const,
      borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: colors.surfaceAlt,
    },
    dragGhost: {
      position: 'absolute' as const, width: 110, height: 110 / 0.72, marginLeft: -55, marginTop: -(110 / 0.72) / 2,
      zIndex: 100, elevation: 8, ...shadow.md,
    },
    dragGhostImg: {
      width: '100%' as const, height: '100%' as const, borderRadius: radius.bubble,
      backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.primary,
    },
    layoutOptions: { padding: spacing.md, gap: spacing.sm },
    layoutOption: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
    layoutOptionActive: { backgroundColor: colors.primary },
    layoutOptionText: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const },
    layoutOptionTextActive: { color: 'white' },
    goalsGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    catalogList: { padding: spacing.md, gap: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
    catalogSection: { gap: spacing.xs },
    catalogSectionTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted, textTransform: 'uppercase' as const, marginBottom: 2 },
    catalogRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    catalogRowPressed: { backgroundColor: colors.surfaceAlt },
    catalogRowIcon: { width: 26, height: 26 },
    artistRowIcon: {
      width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    catalogRowLabel: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    catalogRowCaption: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim, marginTop: 2 },
    catalogRowPin: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
    catalogRowPinText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.primary },

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
            {subTab === 'teams' ? 'Équipes'
              : subTab === 'binders' ? t('favorites.tabBinders')
              : subTab === 'artists' ? t('favorites.tabArtists')
              : subTab === 'trainers' ? t('favorites.tabTrainers')
              : subTab === 'duplicates' ? t('favorites.tabDuplicates')
              : t('favorites.tabExtensions')}
          </Text>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label={t('favorites.tabExtensions')} active={subTab === 'goals'} onPress={() => setSubTab('goals')} />
          <Chip label={t('favorites.tabBinders')} active={subTab === 'binders'} onPress={() => setSubTab('binders')} />
          <Chip label={t('favorites.tabArtists')} active={subTab === 'artists'} onPress={() => setSubTab('artists')} />
          <Chip label={t('favorites.tabDuplicates')} active={subTab === 'duplicates'} onPress={() => setSubTab('duplicates')} />
          <Chip label={t('favorites.tabTrainers')} active={subTab === 'trainers'} onPress={() => setSubTab('trainers')} />
          {/* "Équipes" is intentionally not surfaced for now — kept dormant (state/branch
              still below) for a possible future deckbuilding feature, not deleted. */}
        </ScrollView>
      </View>

      {subTab === 'teams' ? (
        selectedTeam ? (
          <View style={styles.teamEditor}>
            <View style={styles.teamEditorHeader}>
              <BackButton onPress={() => { setSelectedTeamId(null); setRenaming(false); }} />
              {renaming ? (
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  maxLength={40}
                  style={styles.renameInput}
                  onSubmitEditing={() => { renameTeam.mutate({ teamId: selectedTeam.id, name: renameValue.trim() || selectedTeam.name }); setRenaming(false); }}
                  onBlur={() => { renameTeam.mutate({ teamId: selectedTeam.id, name: renameValue.trim() || selectedTeam.name }); setRenaming(false); }}
                />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => { setRenameValue(selectedTeam.name); setRenaming(true); }}>
                  <Text style={styles.teamEditorTitle} numberOfLines={1}>{selectedTeam.name}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setDeleteTarget({ kind: 'team', id: selectedTeam.id, name: selectedTeam.name })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('favorites.a11yDeleteTeam')}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            <View style={styles.slotGrid}>
              {Array.from({ length: TEAM_SIZE }, (_, i) => i).map(slotIndex => {
                const slot = selectedTeam.slots.find(s => s.slotIndex === slotIndex);
                const mon = slot ? POKEDEX_BY_DEX.get(slot.dexNum) : undefined;
                return (
                  <Pressable
                    key={slotIndex}
                    onPress={() => setPickerSlot(slotIndex)}
                    style={styles.slot}
                    accessibilityRole="button"
                    accessibilityLabel={mon ? getName(mon) : t('favorites.a11yAddToSlot')}>
                    {mon ? (
                      <>
                        <Image source={{ uri: ownedImages.get(mon.num) ?? mon.sprite_url }} style={styles.slotSprite} resizeMode="contain" />
                        <Text style={styles.slotName} numberOfLines={1}>{getName(mon)}</Text>
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => { e.stopPropagation(); clearSlot.mutate({ teamId: selectedTeam.id, slotIndex }); }}
                          style={styles.slotClear}
                          accessibilityRole="button"
                          accessibilityLabel={t('favorites.a11yClearSlot')}>
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
                maxLength={40}
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
            <Pressable
              onPress={() => { setSelectedBinderId(null); setBinderRenaming(false); }}
              hitSlop={8}
              accessibilityLabel={t('common.back')}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            {binderRenaming ? (
              <TextInput
                value={binderRenameValue}
                onChangeText={setBinderRenameValue}
                autoFocus
                maxLength={40}
                style={styles.renameInput}
                onSubmitEditing={() => { renameBinder.mutate({ binderId: selectedBinder.id, name: binderRenameValue.trim() || selectedBinder.name }); setBinderRenaming(false); }}
                onBlur={() => { renameBinder.mutate({ binderId: selectedBinder.id, name: binderRenameValue.trim() || selectedBinder.name }); setBinderRenaming(false); }}
              />
            ) : (
              <Pressable style={{ flex: 1 }} onPress={() => { setBinderRenameValue(selectedBinder.name); setBinderRenaming(true); }}>
                <Text style={styles.teamEditorTitle} numberOfLines={1}>{selectedBinder.name}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push(withReturnTo(`/binder/${selectedBinder.id}`, '/favorites') as never)}
              hitSlop={8} style={{ marginRight: spacing.sm }}
              accessibilityLabel={t('favorites.a11yViewBinder')}>
              <Ionicons name="eye-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setLayoutPickerOpen(true)}
              hitSlop={8} style={{ marginRight: spacing.sm }}
              accessibilityLabel={t('favorites.a11yChangeLayout')}>
              <Ionicons name="grid-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setDeleteTarget({ kind: 'binder', id: selectedBinder.id, name: selectedBinder.name })}
              hitSlop={8}
              accessibilityLabel={t('favorites.deleteBinderTitle')}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>

          <View ref={gridContainerRef} onLayout={onGridLayout} style={{ flex: 1 }}>
            <FlashList
              data={Array.from({ length: binderSlotCount }, (_, position) => binderCardsByPosition.get(position) ?? { position })}
              numColumns={BINDER_LAYOUT_COLS[selectedBinder.layout]}
              estimatedItemSize={200}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              maintainVisibleContentPosition={{ disabled: true }}
              scrollEnabled={draggingPosition === null}
              onScroll={(e) => { onGridScroll(e); hideOnScrollProps.onScroll(e); }}
              scrollEventThrottle={16}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              keyExtractor={(s) => String(s.position)}
              renderItem={({ item }) => {
                const filled = 'cardId' in item;
                if (!filled) {
                  return (
                    <View style={styles.binderSlotTile}>
                      <Pressable
                        onPress={() => setPickingPosition(item.position)}
                        style={styles.binderSlotEmpty}
                        accessibilityLabel={t('favorites.a11yAddCard')}>
                        <Ionicons name="add" size={28} color={colors.textDim} />
                      </Pressable>
                    </View>
                  );
                }
                const isCard = item.kind === 'card';
                const isOwned = isCard && ownedCardIds.has(item.cardId as string);
                const isDragging = draggingPosition === item.position;
                const isHoverTarget = hoverPosition === item.position && draggingPosition !== item.position;
                return (
                  <GestureDetector gesture={buildSlotDragGesture(item.position)}>
                    <View
                      onLayout={onTileLayout}
                      style={[styles.binderSlotTile, isDragging && styles.binderSlotDragging, isHoverTarget && styles.binderSlotHover]}>
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
                          onPress={() => setBinderZoom({ image_small: item.imageUrl })}
                          style={styles.zoomBtn}
                          accessibilityLabel={t('favorites.a11yZoomCard')}>
                          <Ionicons name="search" size={14} color="white" />
                        </Pressable>
                        <Pressable
                          hitSlop={8}
                          onPress={() => removeBinderSlot.mutate({ binderId: selectedBinder.id, position: item.position, imagePath: item.imagePath })}
                          style={styles.removeBtn}
                          accessibilityLabel={t('favorites.a11yRemoveCard')}>
                          <Ionicons name="close" size={16} color="white" />
                        </Pressable>
                      </View>
                    </View>
                  </GestureDetector>
                );
              }}
            />
            {draggingPosition != null && draggedItem && (
              <View
                pointerEvents="none"
                style={[styles.dragGhost, {
                  left: dragStartAbsolute.x + dragTranslation.x - gridOriginRef.current.x,
                  top: dragStartAbsolute.y + dragTranslation.y - gridOriginRef.current.y,
                }]}>
                <Image source={{ uri: draggedItem.imageUrl }} style={styles.dragGhostImg} resizeMode="contain" />
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.teamList}>
          <View style={styles.newTeamRow}>
            <TextInput
              placeholder={t('favorites.newBinderPlaceholder')}
              value={newBinderName}
              onChangeText={setNewBinderName}
              onSubmitEditing={handleCreateBinder}
              maxLength={40}
              style={styles.newTeamInput}
            />
            <Pressable onPress={handleCreateBinder} style={styles.newTeamBtn}>
              <Ionicons name="add" size={20} color="white" />
            </Pressable>
          </View>

          {binders.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>{t('favorites.noBindersYet')}</Text>
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
                  <Text style={styles.teamRowCount}>
                    {t(item.itemCount > 1 ? 'favorites.binderCardCountPlural' : 'favorites.binderCardCountSingular', { n: item.itemCount })}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
        )
      ) : subTab === 'artists' ? (
        <View style={styles.teamList}>
          <TextInput
            placeholder={t('favorites.searchArtistPlaceholder')}
            value={artistSearch}
            onChangeText={setArtistSearch}
            style={styles.dupSearchInput}
          />
          {filteredArtists.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>{t('favorites.noArtistFound')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredArtists}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, gap: spacing.xs }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              {...hideOnScrollProps}
              keyExtractor={a => a.artist}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(withReturnTo(`/artist/${encodeURIComponent(item.artist)}`, '/favorites') as never)}
                  style={({ pressed }) => [styles.catalogRow, pressed && styles.catalogRowPressed]}>
                  <View style={styles.artistRowIcon}>
                    <Ionicons name="brush-outline" size={14} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogRowLabel} numberOfLines={1}>{item.artist}</Text>
                    <Text style={styles.catalogRowCaption}>
                      {t('favorites.cardsOfTotal', { owned: ownedCountByArtist.get(item.artist) ?? 0, total: item.cardCount })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
      ) : subTab === 'trainers' ? (
        <TrainersPanel
          userId={userId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      ) : subTab === 'duplicates' ? (
        <>
          <View style={styles.dupHeader}>
            <TextInput
              placeholder={t('favorites.searchCardPlaceholder')}
              value={dupSearch}
              onChangeText={setDupSearch}
              style={styles.dupSearchInput}
            />
            <View style={styles.dupChipRow}>
              <Chip label={t('favorites.sortValue')} active={dupSort === 'value'} onPress={() => setDupSort('value')} />
              <Chip label={t('favorites.sortQuantity')} active={dupSort === 'quantity'} onPress={() => setDupSort('quantity')} />
              <Chip label={t('favorites.sortNameAZ')} active={dupSort === 'name'} onPress={() => setDupSort('name')} />
            </View>
          </View>
          {duplicateCards.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>
                {dupSearch.trim() ? t('favorites.noResults') : t('favorites.noDuplicatesYet')}
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
                      <Text style={styles.dupValueText}>{eurFormatter(locale).format(item.cardmarketTrendEur)}</Text>
                    )}
                    <Text style={styles.dupName} numberOfLines={1}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      ) : (
        <ScrollView
          contentContainerStyle={styles.catalogList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          {...hideOnScrollProps}>
          {goals.length > 0 && (
            <View style={styles.goalsGrid}>
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
            </View>
          )}

          {catalogGroups.map(group => (
            <View key={group.id} style={styles.catalogSection}>
              <Text style={styles.catalogSectionTitle}>{group.label}</Text>
              {group.sets.map(set => {
                const year = set.releaseDate ? new Date(set.releaseDate).getFullYear() : null;
                return (
                  <Pressable
                    key={set.id}
                    onPress={() => toggleGoal.mutate({ setId: set.id, currentlyPinned: false })}
                    style={({ pressed }) => [styles.catalogRow, pressed && styles.catalogRowPressed]}>
                    {set.symbol ? (
                      <Image source={{ uri: set.symbol }} style={styles.catalogRowIcon} resizeMode="contain" />
                    ) : (
                      <View style={styles.catalogRowIcon} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogRowLabel} numberOfLines={1}>{setFlagLabel(set.name, set.region)}</Text>
                      <Text style={styles.catalogRowCaption}>
                        {year ? `${year} · ` : ''}{t('favorites.setCardsCount', { n: set.cardCount })}
                      </Text>
                    </View>
                    <View style={styles.catalogRowPin}>
                      <Text style={styles.catalogRowPinText}>{t('favorites.startPin')}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
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

      <BubbleSheet visible={layoutPickerOpen} onClose={() => setLayoutPickerOpen(false)} tint={colors.primary} title={t('favorites.layoutSheetTitle')} sizing="auto">
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

      <ConfirmDialog
        target={confirmTarget}
        confirmLabel={deleteTarget?.kind === 'setGoal' ? t('common.unpin') : t('common.delete')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <CardZoomModal card={dupZoom} onClose={() => setDupZoom(null)} />
      <CardZoomModal card={binderZoom} onClose={() => setBinderZoom(null)} />
    </SafeAreaView>
  );
}
