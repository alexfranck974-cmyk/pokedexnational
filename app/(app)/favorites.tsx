import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Image, StyleSheet, FlatList, ScrollView, RefreshControl, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useSession } from '@/lib/auth';
import {
  useUserDex, useOwnedCardImages, useOwnedCardFinishes, useAllOwnedCardsDetailed,
  useAllOwnedCardsLedgerDetailed, useOwnedCardQuantities, useAllWishedCards, useToggleWish, type OwnedCardFinish,
} from '@/lib/collection';
import { FINISH_GRADIENT } from '@/lib/finish-visuals';
import { ReverseHoloShimmer } from '@/components/ReverseHoloShimmer';
import { eurFormatter } from '@/lib/trades';
import { withReturnTo, safeDecodeURIComponent } from '@/lib/navigation';
import {
  useTeams, useCreateTeam, useRenameTeam, useDeleteTeam, useSetTeamSlot, useClearTeamSlot,
} from '@/lib/teams';
import {
  useBinders, useCreateBinder, useCreatePrefilledBinder, useRenameBinder, useDeleteBinder,
  useBinderCards, useRemoveBinderSlot, useSetBinderLayout, useSwapBinderSlots,
  useInsertBinderSlot, useDeleteBinderSlot,
  BINDER_LAYOUTS, BINDER_LAYOUT_COLS, type BinderLayout, type BinderSlotItem,
} from '@/lib/binders';
import { useSetGoals, useToggleSetGoal } from '@/lib/collection-goals';
import { useSealedProducts, useAdjustSealedProduct, useSealedProductPrices, SEALED_PRODUCT_TYPES, type SealedProductType } from '@/lib/sealed-products';
import { postBinderCompletedNewsIfNotable } from '@/lib/friend-news';
import { useTcgSets, useTcgArtists, type TcgSetInfo } from '@/lib/tcg-index';
import { getSeriesLogo } from '@/lib/series-logos';
import { Pokeball } from '@/components/Pokeball';
import { BubbleSheet } from '@/components/BubbleSheet';
import { TeamSlotPicker } from '@/components/TeamSlotPicker';
import { BinderSlotPicker } from '@/components/BinderSlotPicker';
import { SetGoalTile } from '@/components/SetGoalTile';
import { TrainersPanel } from '@/components/TrainersPanel';
import { CharacterRarePanel } from '@/components/CharacterRarePanel';
import { TagTeamPanel } from '@/components/TagTeamPanel';
import { CollectionToolsDrawer, type ToolTab } from '@/components/CollectionToolsDrawer';
import { BackButton } from '@/components/BackButton';
import { CardZoomModal, type ZoomableCard } from '@/components/CardZoomModal';
import { CaptureEffect, type CaptureEvent } from '@/components/CaptureEffect';
import { PokedexSectionTabs, sectionIndex, hrefToSection } from '@/components/PokedexSectionTabs';
import { SlideTransition } from '@/components/SlideTransition';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { EmptyState } from '@/components/EmptyState';
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
// Visual left-to-right chip order (not the subTab type's declaration order) —
// drives SlideTransition's direction when switching sub-tabs. 'teams' isn't
// reachable via any visible chip, so it's excluded here on purpose.
const SUBTAB_ORDER = ['goals', 'sealed', 'binders', 'artists', 'duplicates', 'trainers', 'duo', 'tag'] as const;
// The curated-TCG-index tools, reachable only via the pull-tab drawer — see
// CollectionToolsDrawer for why these are split out of the primary chips.
const TOOL_TABS = ['artists', 'duplicates', 'trainers', 'duo', 'tag'] as const;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// One flattened row of the Extensions tab's ScrollView — see
// buildExtensionsFlatRows for why this needs to be a flat array at all.
type ExtensionsFlatRow =
  | { type: 'region'; key: string; label: string; count: number; collapsed: boolean; onToggle: () => void }
  | { type: 'series'; key: string; label: string; count: number; collapsed: boolean; onToggle: () => void }
  | { type: 'pinnedGrid'; key: string; sets: TcgSetInfo[] }
  | { type: 'catalogSetRow'; key: string; set: TcgSetInfo };

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

// Styled as a binder index tab, not a pill filter chip — top corners only,
// the active one raised and shadowed to read as "the page you're on", the
// rest sitting flatter/lower like tabs tucked behind it. Reinforces the same
// "classeur" language as the pull-tab drawer (CollectionToolsDrawer) instead
// of two unrelated visual idioms on the same screen.
const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const chipStyles = useThemedStyles((colors, shadow) => ({
    chip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md,
      backgroundColor: colors.surfaceAlt, marginTop: 5,
    },
    active: {
      backgroundColor: colors.primary, marginTop: 0,
      paddingHorizontal: 18, paddingVertical: 10, ...shadow.sm,
    },
    text: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    textActive: { color: 'white', fontSize: 14 },
  }));
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.active]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </Pressable>
  );
};

export default function FavoritesScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
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
  const { data: finishesByCard = new Map<string, OwnedCardFinish[]>() } = useOwnedCardFinishes(userId);
  const { data: ownedCardsDetailed = [] } = useAllOwnedCardsDetailed(userId);
  const { data: ledgerCards = [], isLoading: ledgerCardsLoading } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const wishedIds = useMemo(() => new Set(wishedCards.map(c => c.id)), [wishedCards]);
  const toggleWish = useToggleWish();

  const { data: teams = [] } = useTeams(userId);
  const createTeam = useCreateTeam();
  const renameTeam = useRenameTeam();
  const deleteTeam = useDeleteTeam();
  const setSlot = useSetTeamSlot();
  const clearSlot = useClearTeamSlot();

  const { data: binders = [], isLoading: bindersLoading } = useBinders(userId);
  const createBinder = useCreateBinder();
  const createPrefilledBinder = useCreatePrefilledBinder();
  const renameBinder = useRenameBinder();
  const deleteBinder = useDeleteBinder();
  const removeBinderSlot = useRemoveBinderSlot();
  const setBinderLayout = useSetBinderLayout();
  const swapBinderSlots = useSwapBinderSlots();
  const insertBinderSlot = useInsertBinderSlot();
  const deleteBinderSlot = useDeleteBinderSlot();

  const { data: goals = [] } = useSetGoals(userId);
  const toggleGoal = useToggleSetGoal();
  const { data: allSets = [] } = useTcgSets();
  const { data: sealedProducts = new Map<string, Map<SealedProductType, number>>() } = useSealedProducts(userId);
  const { data: sealedProductPrices = new Map<string, Map<SealedProductType, number>>() } = useSealedProductPrices();
  const adjustSealed = useAdjustSealedProduct();
  const [sealedSheetSet, setSealedSheetSet] = useState<TcgSetInfo | null>(null);
  const pinnedSetIds = useMemo(() => new Set(goals.map(g => g.setId)), [goals]);
  // Unpinned sets, grouped by region and kept in useTcgSets()'s own release-date-desc
  // order within each group — no stats shown here, that's what pinning unlocks.
  // Two-level: region, then (global only) era/series within it — e.g. "Mega
  // Evolution" groups Pitch Black/Chaos Rising/Perfect Order/... instead of
  // one flat 126-set list. JP/CN only ever carry a flat region label in
  // `series` (see TcgSetInfo), not a real per-era value, so they get a
  // single unlabeled subgroup — same flat list as before this feature.
  // Shared by both the pinned-goals grid and the unpinned catalog below it —
  // same era grouping in both places, kept as two separate sections (rather
  // than merged into one) so "what am I actively working on" stays a quick
  // glance at the top instead of buried in the full list.
  const groupByRegionAndSeries = (sets: TcgSetInfo[]) => REGION_ORDER
    .map(r => {
      const regionSets = sets.filter(s => (s.region || 'global') === r.id);
      if (r.id !== 'global') return { ...r, subgroups: [{ id: r.id, label: null as string | null, sets: regionSets }] };

      // `sets` is already newest-first (useTcgSets' own query order), so the
      // first set encountered for a given series is that series' most
      // recent — subgroup order falls out of that for free, no extra sort.
      const bySeries = new Map<string, typeof regionSets>();
      const order: string[] = [];
      for (const s of regionSets) {
        const key = s.series ?? t('favorites.seriesOther');
        if (!bySeries.has(key)) { bySeries.set(key, []); order.push(key); }
        bySeries.get(key)!.push(s);
      }
      return { ...r, subgroups: order.map(key => ({ id: key, label: key as string | null, sets: bySeries.get(key)! })) };
    })
    .filter(g => g.subgroups.some(sg => sg.sets.length > 0));

  const catalogGroups = useMemo(
    () => groupByRegionAndSeries(allSets.filter(s => !pinnedSetIds.has(s.id))),
    [allSets, pinnedSetIds, locale],
  );
  const pinnedGroups = useMemo(
    () => groupByRegionAndSeries(allSets.filter(s => pinnedSetIds.has(s.id))),
    [allSets, pinnedSetIds, locale],
  );
  // Scellés browses the full catalog (no pin concept for sealed inventory) —
  // same region/series grouping as Extensions, just every set instead of a
  // pinned/unpinned split.
  const sealedGroups = useMemo(() => groupByRegionAndSeries(allSets), [allSets, locale]);
  // Per-region collapse, independent toggles (not an accordion) — collapsing
  // the regions you don't care about is how you narrow the list down to just
  // the one you want, e.g. hide jp+cn to browse only Global. Shared between
  // the pinned and catalog sections — collapsing e.g. JP in one place means
  // you don't want to see JP right now anywhere on this screen.
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());
  // Per-series collapse, within the (expanded) global region — same
  // independent-toggle spirit, keyed by series name since that's unique
  // enough within global's own subgroup list. Series ids can repeat between
  // the pinned and catalog sections (both group by the same era names), so a
  // pinned-section key is prefixed to keep the two toggles independent —
  // collapsing "Mega Evolution" among your pinned sets shouldn't also
  // collapse it in the full catalog below.
  const [collapsedSeries, setCollapsedSeries] = useState<Set<string>>(new Set());
  const toggleSeriesCollapsed = (seriesId: string) => setCollapsedSeries(prev => {
    const next = new Set(prev);
    if (next.has(seriesId)) next.delete(seriesId); else next.add(seriesId);
    return next;
  });
  const toggleRegionCollapsed = (regionId: string) => setCollapsedRegions(prev => {
    const next = new Set(prev);
    if (next.has(regionId)) next.delete(regionId); else next.add(regionId);
    return next;
  });

  // Flattens the pinned-goals + catalog sections (region -> series -> sets)
  // into one array of direct ScrollView children, so region/series headers
  // can be passed to stickyHeaderIndices — RN's ScrollView only sticks
  // *direct* children, not arbitrarily nested ones, which is what the old
  // per-group <View> wrapping prevented. Region/series headers are
  // normalized into one shape here (they render identically either way)
  // instead of the old duplicated pinned/catalog header JSX.
  const buildExtensionsFlatRows = (groups: typeof catalogGroups, kind: 'pinned' | 'catalog'): ExtensionsFlatRow[] => {
    const rows: ExtensionsFlatRow[] = [];
    for (const group of groups) {
      const regionCollapsed = collapsedRegions.has(group.id);
      const totalCount = group.subgroups.reduce((n, sg) => n + sg.sets.length, 0);
      rows.push({
        type: 'region', key: `${kind}-region:${group.id}`, label: group.label, count: totalCount,
        collapsed: regionCollapsed, onToggle: () => toggleRegionCollapsed(group.id),
      });
      if (regionCollapsed) continue;
      for (const subgroup of group.subgroups) {
        // Pinned/catalog collapse independently even for the "same" series —
        // see collapsedSeries' own comment above.
        const seriesKey = kind === 'pinned' ? `pinned:${subgroup.id}` : subgroup.id;
        if (subgroup.label != null) {
          const seriesCollapsed = collapsedSeries.has(seriesKey);
          rows.push({
            type: 'series', key: `${kind}-series:${subgroup.id}`, label: subgroup.label, count: subgroup.sets.length,
            collapsed: seriesCollapsed, onToggle: () => toggleSeriesCollapsed(seriesKey),
          });
          if (seriesCollapsed) continue;
        }
        if (kind === 'pinned') {
          rows.push({ type: 'pinnedGrid', key: `pinned-grid:${subgroup.id}`, sets: subgroup.sets });
        } else {
          for (const set of subgroup.sets) rows.push({ type: 'catalogSetRow', key: `catalog-row:${set.id}`, set });
        }
      }
    }
    return rows;
  };
  const extensionsFlatRows = useMemo(
    () => [...buildExtensionsFlatRows(pinnedGroups, 'pinned'), ...buildExtensionsFlatRows(catalogGroups, 'catalog')],
    [pinnedGroups, catalogGroups, collapsedRegions, collapsedSeries],
  );
  const extensionsStickyIndices = useMemo(
    () => extensionsFlatRows.reduce<number[]>((acc, row, i) => {
      if (row.type === 'region' || row.type === 'series') acc.push(i);
      return acc;
    }, []),
    [extensionsFlatRows],
  );

  const { data: allArtists = [], isLoading: artistsLoading } = useTcgArtists();
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

  const [subTab, setSubTab] = useState<'teams' | 'binders' | 'goals' | 'sealed' | 'artists' | 'trainers' | 'duplicates' | 'duo' | 'tag'>('goals');
  const isToolTab = (TOOL_TABS as readonly string[]).includes(subTab);

  // Slide-in direction/replay-token for the sub-tab content below — shared by
  // two sources so whichever happened most recently wins: arriving here from
  // Pokédex/Wishlist (section-level, via the `from` param) or switching
  // sub-tab chips locally. Unlike pokedex.tsx/wishlist.tsx this screen stays
  // on the same mounted instance across both kinds of change, so a single
  // navToken/direction pair (not a key-forced remount) is what makes
  // SlideTransition replay correctly for either trigger.
  const [subTabTransitionDirection, setSubTabTransitionDirection] = useState<'left' | 'right' | null>(null);
  const [subTabNavToken, setSubTabNavToken] = useState(0);
  useEffect(() => {
    if (!from) return;
    const fromSection = hrefToSection(safeDecodeURIComponent(from));
    const fromIdx = fromSection ? sectionIndex(fromSection) : null;
    const ownIdx = sectionIndex('collection');
    const dir: 'left' | 'right' | null = fromIdx === null || fromIdx === ownIdx ? null : fromIdx < ownIdx ? 'right' : 'left';
    setSubTabTransitionDirection(dir);
    setSubTabNavToken(n => n + 1);
    router.setParams({ from: undefined });
  }, [from, router]);
  const prevSubTabRef = useRef(subTab);
  useEffect(() => {
    const prev = prevSubTabRef.current;
    prevSubTabRef.current = subTab;
    if (prev === subTab) return;
    const prevIdx = SUBTAB_ORDER.indexOf(prev as (typeof SUBTAB_ORDER)[number]);
    const nextIdx = SUBTAB_ORDER.indexOf(subTab as (typeof SUBTAB_ORDER)[number]);
    const dir: 'left' | 'right' | null = prevIdx === -1 || nextIdx === -1 ? null : nextIdx > prevIdx ? 'right' : 'left';
    setSubTabTransitionDirection(dir);
    setSubTabNavToken(n => n + 1);
  }, [subTab]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null);
  const [newBinderName, setNewBinderName] = useState('');
  // Creation wizard — step 1 (name) reuses newBinderName above; steps 2-3
  // (layout, mode/set) live in their own sheet, opened once a name is typed.
  const [binderWizardStep, setBinderWizardStep] = useState<'layout' | 'mode' | 'set' | null>(null);
  const [wizardLayout, setWizardLayout] = useState<BinderLayout>(9);
  const [wizardMode, setWizardMode] = useState<'free' | 'prefill'>('free');
  const [wizardSetIds, setWizardSetIds] = useState<Set<string>>(new Set());
  const [wizardSetSearch, setWizardSetSearch] = useState('');
  const [wizardIncludeReverse, setWizardIncludeReverse] = useState(false);
  const [wizardReverseMode, setWizardReverseMode] = useState<'trailing' | 'interleaved'>('trailing');
  const [binderRenaming, setBinderRenaming] = useState(false);
  const [binderRenameValue, setBinderRenameValue] = useState('');
  const [pickingPosition, setPickingPosition] = useState<number | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  // "Organiser" mode — insert/delete-with-shift, distinct from drag (move) and
  // ✕ (clear content). Tool-then-target: arm a tool from the floating
  // toolbar, then tap any slot to apply it. Stays armed across taps so
  // several inserts/deletes can be chained without re-tapping the tool.
  const [organizeMode, setOrganizeMode] = useState(false);
  const [armedTool, setArmedTool] = useState<'insertLeft' | 'insertRight' | 'delete' | null>(null);

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
    const list = q ? allArtists.filter(a => normalize(a.artist).includes(q)) : allArtists;
    // Most-owned artist first — the query's own alphabetical order otherwise
    // buries the artists a collector actually has cards from.
    return [...list].sort((a, b) =>
      (ownedCountByArtist.get(b.artist) ?? 0) - (ownedCountByArtist.get(a.artist) ?? 0) || a.artist.localeCompare(b.artist),
    );
  }, [allArtists, debouncedArtistSearch, ownedCountByArtist]);

  const wizardFilteredSets = useMemo(() => {
    const q = normalize(wizardSetSearch.trim());
    return q ? allSets.filter(s => normalize(s.name).includes(q)) : allSets;
  }, [allSets, wizardSetSearch]);

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
  // Per-finish, not just per-card — the schema allows the same card_id to
  // occupy two slots (e.g. a normal print and its reverse-holo print), see
  // 052_binder_slot_finish.sql. Blocking on cardId alone would make it
  // impossible to ever add a card's reverse-holo copy once its normal copy
  // was already placed.
  const binderFinishesByCardId = useMemo(() => {
    const m = new Map<string, Set<OwnedCardFinish>>();
    for (const c of binderCards) {
      if (!c.cardId) continue;
      const set = m.get(c.cardId) ?? new Set<OwnedCardFinish>();
      set.add(c.finish ?? 'normal');
      m.set(c.cardId, set);
    }
    return m;
  }, [binderCards]);
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

  // Completion = every FILLED card slot (not the trailing "+" padding from
  // binderSlotCount above, and not photo slots) is owned in the matching
  // finish. Deliberately not gated on there being zero empty "+" slots left —
  // an unused template slot isn't "missing a needed card," it's just unused
  // capacity, same mental model as a real album with extra blank pages.
  const binderCompletion = useMemo(() => {
    if (!selectedBinder) return null;
    const cardSlots = binderCards.filter(c => c.kind === 'card');
    if (cardSlots.length === 0) return null;
    const ownedCount = cardSlots.filter(c => finishesByCard.get(c.cardId as string)?.includes(c.finish ?? 'normal')).length;
    return { isComplete: ownedCount === cardSlots.length };
  }, [selectedBinder, binderCards, finishesByCard]);

  // Fires the celebration exactly once per binder, only on a genuine
  // incomplete->complete transition observed live — never on first sight of
  // an already-complete binder (a binder someone finished last week
  // shouldn't celebrate every time they open it). completionSeenRef tracks
  // "have we recorded ANY state for this binder id yet", not just its value,
  // so that first-sight case reads as "unknown", not "was incomplete".
  const completionSeenRef = useRef<Map<string, boolean>>(new Map());
  const [completionCelebration, setCompletionCelebration] = useState<CaptureEvent | null>(null);
  useEffect(() => {
    if (!selectedBinder || !binderCompletion) return;
    const key = selectedBinder.id;
    const prev = completionSeenRef.current.get(key);
    completionSeenRef.current.set(key, binderCompletion.isComplete);
    if (prev === undefined) return;
    if (binderCompletion.isComplete && !prev) {
      setCompletionCelebration({ id: `binder-complete-${key}-${Date.now()}`, kind: 'binderComplete', binderName: selectedBinder.name });
      if (userId) postBinderCompletedNewsIfNotable(userId, key, selectedBinder.name);
    }
  }, [selectedBinder, binderCompletion, userId]);

  // Long-press-then-drag gesture for one occupied binder slot. Hit-testing is
  // done by grid geometry (origin + scroll offset + measured tile size), not
  // by measuring every tile — FlashList recycles views, so per-tile layout
  // tracking would be unreliable across scroll. On release, swaps (or moves,
  // if the target is empty) the dragged slot with whatever's under the finger.
  const buildSlotDragGesture = (position: number) => {
    // A single Pan gated by activateAfterLongPress instead of Simultaneous(LongPress, Pan):
    // the old composition let Pan's own minDistance(10) claim the touch on any 10px
    // finger movement — including an ordinary scroll swipe starting on a filled tile —
    // before the long-press had actually fired, which is what was blocking FlashList's
    // scroll. activateAfterLongPress makes Pan itself wait out the hold before it can
    // activate, so a normal swipe scrolls and only a held-then-dragged touch triggers a swap.
    // On web that alone isn't enough: RNGH statically sets touch-action:none on any element
    // with a Pan gesture attached (see the GestureDetector's touchAction="pan-y" prop below),
    // which blocks native scroll outright regardless of activation timing. "pan-y" tells the
    // browser to keep handling vertical scroll natively; a stationary long-press still gets
    // its pointerdown/hold delivered to JS since touch-action only governs actual movement.
    return Gesture.Pan()
      .activateAfterLongPress(250)
      .minDistance(10)
      .onStart((e) => {
        activeDragPositionRef.current = position;
        hoverPositionRef.current = position;
        setDraggingPosition(position);
        setHoverPosition(position);
        setDragStartAbsolute({ x: e.absoluteX, y: e.absoluteY });
        setDragTranslation({ x: 0, y: 0 });
      })
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

  const openBinderWizard = () => {
    const name = newBinderName.trim();
    if (!name) return;
    setWizardLayout(9);
    setWizardMode('free');
    setWizardSetIds(new Set());
    setWizardSetSearch('');
    setWizardIncludeReverse(false);
    setWizardReverseMode('trailing');
    setBinderWizardStep('layout');
  };

  const finishBinderWizard = async () => {
    const name = newBinderName.trim();
    if (!name) return;
    const setIds = Array.from(wizardSetIds);
    const id = wizardMode === 'prefill' && setIds.length > 0
      ? await createPrefilledBinder.mutateAsync({
          name, layout: wizardLayout, setIds,
          includeReverse: wizardIncludeReverse,
          reverseMode: wizardReverseMode,
        })
      : await createBinder.mutateAsync({ name, layout: wizardLayout });
    setNewBinderName('');
    setBinderWizardStep(null);
    setSelectedBinderId(id);
  };

  const toggleOrganizeMode = () => {
    setOrganizeMode(o => !o);
    setArmedTool(null);
  };

  const applyArmedTool = (position: number) => {
    if (!armedTool || !selectedBinder) return;
    if (armedTool === 'insertLeft') insertBinderSlot.mutate({ binderId: selectedBinder.id, position });
    else if (armedTool === 'insertRight') insertBinderSlot.mutate({ binderId: selectedBinder.id, position: position + 1 });
    else deleteBinderSlot.mutate({ binderId: selectedBinder.id, position });
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
    chipRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: spacing.xs },

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
    binderCardCount: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted, marginTop: -spacing.sm },
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
      // Bottom-left, deliberately not top-left/top-right — those corners are
      // already taken by zoomBtn/removeBtn and used to silently collide with
      // removeBtn (both top:4,right:4), hiding this badge behind it whenever
      // a slot held a not-owned card.
      position: 'absolute' as const, bottom: 4, left: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    // Bottom-right — the only free corner (zoomBtn top-left, removeBtn top-right,
    // notOwnedBadge bottom-left). Only shown while not yet owned: once owned, the
    // reverse-holo LinearGradient border alone communicates the finish, same
    // convention as CardTile elsewhere in the app.
    reverseHoloBadge: {
      position: 'absolute' as const, bottom: 4, right: 4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
      borderWidth: 1, borderColor: '#8fa3b3',
    },
    reverseHoloBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#8fa3b3' },
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

    wizardBody: { padding: spacing.md, gap: spacing.md },
    wizardHint: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    wizardBtn: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' as const },
    wizardBtnDisabled: { opacity: 0.5 },
    wizardBtnText: { fontSize: 15, fontFamily: fonts.bodyBold, color: 'white' },
    wizardBackBtn: { alignSelf: 'flex-start' as const, padding: spacing.xs },
    wizardBackBtnText: { fontSize: 13, fontFamily: fonts.body, color: colors.primary },
    // surface, not surfaceAlt — the Chip pills below use surfaceAlt as their own
    // background, so a matching toolbar backdrop made them invisible (no visible
    // frame around the "Insérer à gauche/droite / Supprimer" tap targets).
    organizeToolbar: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    organizeHint: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    organizeSlot: {
      flex: 1, borderRadius: radius.bubble, borderWidth: 2, borderColor: colors.warning,
      alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const,
      backgroundColor: colors.surfaceAlt,
    },
    goalsGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm, marginBottom: spacing.xs },
    catalogList: { padding: spacing.md, gap: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
    // Extensions' own flattened rows (see buildExtensionsFlatRows) sit as
    // direct ScrollView children instead of nested per-group Views, so the
    // rhythm between sections/rows comes from each row's own margin below
    // rather than a container `gap` (which would otherwise apply between
    // *every* row, headers included, cramming the sticky headers too).
    catalogListFlat: { padding: spacing.md, paddingBottom: TAB_BAR_CLEARANCE },
    catalogSection: { gap: spacing.xs },
    // backgroundColor here is what keeps a stuck header opaque instead of
    // showing rows scrolling by underneath it.
    catalogSectionHeader: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      paddingVertical: 4, marginTop: spacing.lg, backgroundColor: colors.bg,
    },
    catalogSectionTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted, textTransform: 'uppercase' as const, marginBottom: 2 },
    catalogSeriesHeader: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      paddingVertical: 4, paddingLeft: spacing.sm, marginTop: spacing.xs, backgroundColor: colors.bg,
    },
    catalogSeriesTitle: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textDim },
    catalogSeriesLogo: { width: 72, height: 22, marginRight: spacing.xs },
    catalogRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, ...shadow.sm,
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
    sealedCountBadge: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center' as const },
    sealedCountBadgeText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.primary },
    sealedTypeRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      paddingVertical: spacing.xs,
    },
    sealedTypeLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.text },
    sealedTypePrice: { fontSize: 11, fontFamily: fonts.mono, color: colors.success, marginTop: 1 },
    sealedTotalValue: {
      fontSize: 13, fontFamily: fonts.monoBold, color: colors.success, textAlign: 'right' as const,
      marginBottom: spacing.xs,
    },
    sealedQuantityPill: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 4,
    },
    sealedQuantityText: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text, minWidth: 18, textAlign: 'center' as const },

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
    dupHeartBtn: {
      position: 'absolute' as const, bottom: 4, right: 4, width: 24, height: 24, borderRadius: 12,
      backgroundColor: colors.overlay, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    dupHeart: { fontSize: 15, color: colors.textDim, lineHeight: 18 },
    dupHeartFilled: { color: colors.danger },
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
              : subTab === 'sealed' ? t('favorites.tabSealed')
              : subTab === 'artists' ? t('favorites.tabArtists')
              : subTab === 'trainers' ? t('favorites.tabTrainers')
              : subTab === 'duplicates' ? t('favorites.tabDuplicates')
              : subTab === 'duo' ? t('favorites.tabDuo')
              : subTab === 'tag' ? t('favorites.tabTag')
              : t('favorites.tabExtensions')}
          </Text>
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {/* Primary row = "vitrines" of the user's own collection. The curated
              TCG-index tools (Artistes/Doublons/Dresseurs/Duos/Tag) live behind
              the pull-tab drawer instead of crowding this scroll row —
              see CollectionToolsDrawer. */}
          <Chip label={t('favorites.tabExtensions')} active={subTab === 'goals'} onPress={() => setSubTab('goals')} />
          <Chip label={t('favorites.tabSealed')} active={subTab === 'sealed'} onPress={() => setSubTab('sealed')} />
          <Chip label={t('favorites.tabBinders')} active={subTab === 'binders'} onPress={() => setSubTab('binders')} />
          {/* "Équipes" is intentionally not surfaced for now — kept dormant (state/branch
              still below) for a possible future deckbuilding feature, not deleted. */}
        </ScrollView>
      </View>

      <SlideTransition transitionKey={subTabNavToken} direction={subTabTransitionDirection} style={{ flex: 1 }}>
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
                <EmptyState icon="people-outline" hint="Aucune équipe pour l’instant — crée-en une ci-dessus." />
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
              onPress={toggleOrganizeMode}
              hitSlop={8} style={{ marginRight: spacing.sm }}
              accessibilityLabel={t('favorites.a11yOrganize')}>
              <Ionicons name="construct-outline" size={20} color={organizeMode ? colors.warning : colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setDeleteTarget({ kind: 'binder', id: selectedBinder.id, name: selectedBinder.name })}
              hitSlop={8}
              accessibilityLabel={t('favorites.deleteBinderTitle')}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <Text style={styles.binderCardCount}>
            {t(binderCards.length > 1 ? 'favorites.binderCardCountPlural' : 'favorites.binderCardCountSingular', { n: binderCards.length })}
          </Text>

          {organizeMode && (
            <View style={styles.organizeToolbar}>
              <Text style={styles.organizeHint}>
                {t(armedTool ? 'favorites.organizeHintArmed' : 'favorites.organizeHintIdle')}
              </Text>
              <View style={styles.chipRow}>
                <Chip label={t('favorites.organizeInsertLeft')} active={armedTool === 'insertLeft'} onPress={() => setArmedTool('insertLeft')} />
                <Chip label={t('favorites.organizeInsertRight')} active={armedTool === 'insertRight'} onPress={() => setArmedTool('insertRight')} />
                <Chip label={t('favorites.organizeDelete')} active={armedTool === 'delete'} onPress={() => setArmedTool('delete')} />
              </View>
            </View>
          )}

          <View ref={gridContainerRef} onLayout={onGridLayout} style={{ flex: 1 }}>
            <FlashList
              data={Array.from({ length: binderSlotCount }, (_, position) => binderCardsByPosition.get(position) ?? { position })}
              numColumns={BINDER_LAYOUT_COLS[selectedBinder.layout]}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              maintainVisibleContentPosition={{ disabled: true }}
              scrollEnabled={draggingPosition === null}
              onScroll={(e) => { onGridScroll(e); hideOnScrollProps.onScroll(e); }}
              scrollEventThrottle={16}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              keyExtractor={(s) => String(s.position)}
              renderItem={({ item }) => {
                const filled = 'cardId' in item;
                if (organizeMode) {
                  return (
                    <View style={styles.binderSlotTile}>
                      <Pressable onPress={() => applyArmedTool(item.position)} style={styles.organizeSlot}>
                        {filled ? (
                          <Image source={{ uri: (item as BinderSlotItem).imageUrl }} style={styles.collectionImg} resizeMode="contain" />
                        ) : (
                          <View style={styles.binderSlotEmpty} />
                        )}
                      </Pressable>
                    </View>
                  );
                }
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
                const itemFinish: OwnedCardFinish = item.finish ?? 'normal';
                const isOwned = isCard && (finishesByCard.get(item.cardId as string)?.includes(itemFinish) ?? false);
                const isDragging = draggingPosition === item.position;
                const isHoverTarget = hoverPosition === item.position && draggingPosition !== item.position;
                return (
                  <GestureDetector gesture={buildSlotDragGesture(item.position)} touchAction="pan-y">
                    <View
                      onLayout={onTileLayout}
                      style={[styles.binderSlotTile, isDragging && styles.binderSlotDragging, isHoverTarget && styles.binderSlotHover]}>
                      <View style={styles.collectionImgWrap}>
                        {isOwned ? (
                          <LinearGradient
                            colors={FINISH_GRADIENT[itemFinish] ?? [colors.primary, colors.warning, colors.primary]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.holoBorder}>
                            <View style={styles.holoInner}>
                              <Image source={{ uri: item.imageUrl }} style={styles.collectionImg} resizeMode="contain" />
                              {itemFinish === 'reverse_holo' && <ReverseHoloShimmer />}
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
                        {isCard && itemFinish === 'reverse_holo' && !isOwned && (
                          <View style={styles.reverseHoloBadge}>
                            <Text style={styles.reverseHoloBadgeText}>R</Text>
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
              onSubmitEditing={openBinderWizard}
              maxLength={40}
              style={styles.newTeamInput}
            />
            <Pressable onPress={openBinderWizard} style={styles.newTeamBtn}>
              <Ionicons name="add" size={20} color="white" />
            </Pressable>
          </View>

          {bindersLoading ? (
            <View>
              {Array.from({ length: 5 }, (_, i) => (
                <SkeletonBlock key={i} style={{ height: 56, marginBottom: spacing.sm }} />
              ))}
            </View>
          ) : binders.length === 0 ? (
            <View style={styles.center}>
              <EmptyState icon="albums-outline" hint={t('favorites.noBindersYet')} />
            </View>
          ) : (
            <FlatList
              data={binders}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              {...hideOnScrollProps}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedBinderId(item.id)}
                  onLongPress={() => setDeleteTarget({ kind: 'binder', id: item.id, name: item.name })}
                  style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
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
          {artistsLoading ? (
            <View>
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonBlock key={i} style={{ height: 48, marginBottom: spacing.xs }} />
              ))}
            </View>
          ) : filteredArtists.length === 0 ? (
            <View style={styles.center}>
              <EmptyState icon="search-outline" hint={t('favorites.noArtistFound')} />
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
      ) : subTab === 'duo' ? (
        <CharacterRarePanel
          userId={userId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      ) : subTab === 'tag' ? (
        <TagTeamPanel
          userId={userId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      ) : subTab === 'sealed' ? (
        <ScrollView
          contentContainerStyle={styles.catalogList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          {...hideOnScrollProps}>
          {sealedGroups.map(group => {
            const regionKey = `sealed:${group.id}`;
            const collapsed = collapsedRegions.has(regionKey);
            const totalSets = group.subgroups.reduce((n, sg) => n + sg.sets.length, 0);
            return (
              <View key={group.id} style={styles.catalogSection}>
                <Pressable
                  onPress={() => toggleRegionCollapsed(regionKey)}
                  style={styles.catalogSectionHeader}
                  accessibilityRole="button"
                  accessibilityLabel={t(collapsed ? 'favorites.a11yExpandRegion' : 'favorites.a11yCollapseRegion', { region: group.label })}>
                  <Text style={styles.catalogSectionTitle}>{group.label} · {totalSets}</Text>
                  <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.textMuted} />
                </Pressable>
                {!collapsed && group.subgroups.map(subgroup => {
                  const seriesKey = `sealed:${subgroup.id}`;
                  const seriesCollapsed = subgroup.label != null && collapsedSeries.has(seriesKey);
                  return (
                    <View key={subgroup.id}>
                      {subgroup.label != null && (
                        <Pressable
                          onPress={() => toggleSeriesCollapsed(seriesKey)}
                          style={styles.catalogSeriesHeader}
                          accessibilityRole="button"
                          accessibilityLabel={t(seriesCollapsed ? 'favorites.a11yExpandSeries' : 'favorites.a11yCollapseSeries', { series: subgroup.label })}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            {getSeriesLogo(subgroup.label) && (
                              <Image source={{ uri: getSeriesLogo(subgroup.label) }} style={styles.catalogSeriesLogo} resizeMode="contain" />
                            )}
                            <Text style={styles.catalogSeriesTitle}>{subgroup.label} · {subgroup.sets.length}</Text>
                          </View>
                          <Ionicons name={seriesCollapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={colors.textDim} />
                        </Pressable>
                      )}
                      {!seriesCollapsed && subgroup.sets.map(set => {
                        const totalForSet = Array.from(sealedProducts.get(set.id)?.values() ?? []).reduce((a: number, b: number) => a + b, 0);
                        return (
                          <Pressable
                            key={set.id}
                            onPress={() => setSealedSheetSet(set)}
                            style={({ pressed }) => [styles.catalogRow, pressed && styles.catalogRowPressed]}>
                            {set.symbol ? (
                              <Image source={{ uri: set.symbol }} style={styles.catalogRowIcon} resizeMode="contain" />
                            ) : (
                              <View style={styles.catalogRowIcon} />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.catalogRowLabel} numberOfLines={1}>{setFlagLabel(set.name, set.region)}</Text>
                            </View>
                            {totalForSet > 0 && (
                              <View style={styles.sealedCountBadge}>
                                <Text style={styles.sealedCountBadgeText}>{totalForSet}</Text>
                              </View>
                            )}
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
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
          {ledgerCardsLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 6 }}>
              {Array.from({ length: numColsFor(width) * 3 }, (_, i) => (
                <View key={i} style={{ width: `${100 / numColsFor(width)}%`, padding: 6 }}>
                  <SkeletonBlock style={{ aspectRatio: 0.72 }} />
                </View>
              ))}
            </View>
          ) : duplicateCards.length === 0 ? (
            <View style={styles.center}>
              <EmptyState
                icon={dupSearch.trim() ? 'search-outline' : 'copy-outline'}
                hint={dupSearch.trim() ? t('favorites.noResults') : t('favorites.noDuplicatesYet')}
              />
            </View>
          ) : (
            <FlashList
              data={duplicateCards}
              numColumns={numColsFor(width)}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              maintainVisibleContentPosition={{ disabled: true }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
              {...hideOnScrollProps}
              keyExtractor={c => c.cardId}
              renderItem={({ item }) => {
                if (!item) return null;
                const qty = quantities.get(item.cardId) ?? 0;
                const wished = wishedIds.has(item.cardId);
                return (
                  <Pressable
                    style={styles.dupTile}
                    onPress={() => setDupZoom({ image_small: item.imageSmall, image_large: item.imageLarge })}>
                    <View style={styles.dupImgWrap}>
                      <Image source={{ uri: item.imageSmall }} style={styles.dupImg} resizeMode="contain" />
                      <View style={styles.dupQtyBadge}>
                        <Text style={styles.dupQtyText}>×{qty}</Text>
                      </View>
                      <Pressable
                        hitSlop={8}
                        accessibilityLabel={t('favorites.a11yToggleWish')}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleWish.mutate({ cardId: item.cardId, currentlyWished: wished, dexNum: item.dexNum });
                        }}
                        style={styles.dupHeartBtn}>
                        <Text style={[styles.dupHeart, wished && styles.dupHeartFilled]}>{wished ? '♥' : '♡'}</Text>
                      </Pressable>
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
          contentContainerStyle={styles.catalogListFlat}
          stickyHeaderIndices={extensionsStickyIndices}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          {...hideOnScrollProps}>
          {extensionsFlatRows.map(row => {
            if (row.type === 'region') {
              return (
                <Pressable
                  key={row.key}
                  onPress={row.onToggle}
                  style={styles.catalogSectionHeader}
                  accessibilityRole="button"
                  accessibilityLabel={t(row.collapsed ? 'favorites.a11yExpandRegion' : 'favorites.a11yCollapseRegion', { region: row.label })}>
                  <Text style={styles.catalogSectionTitle}>{row.label} · {row.count}</Text>
                  <Ionicons name={row.collapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.textMuted} />
                </Pressable>
              );
            }
            if (row.type === 'series') {
              return (
                <Pressable
                  key={row.key}
                  onPress={row.onToggle}
                  style={styles.catalogSeriesHeader}
                  accessibilityRole="button"
                  accessibilityLabel={t(row.collapsed ? 'favorites.a11yExpandSeries' : 'favorites.a11yCollapseSeries', { series: row.label })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {getSeriesLogo(row.label) && (
                      <Image source={{ uri: getSeriesLogo(row.label) }} style={styles.catalogSeriesLogo} resizeMode="contain" />
                    )}
                    <Text style={styles.catalogSeriesTitle}>{row.label} · {row.count}</Text>
                  </View>
                  <Ionicons name={row.collapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={colors.textDim} />
                </Pressable>
              );
            }
            if (row.type === 'pinnedGrid') {
              return (
                <View key={row.key} style={styles.goalsGrid}>
                  {row.sets.map(set => {
                    const setName = setFlagLabel(set.name, set.region);
                    return (
                      <SetGoalTile
                        key={set.id}
                        userId={userId}
                        setId={set.id}
                        setName={setName}
                        total={set.cardCount}
                        symbol={set.symbol}
                        onPress={() => router.push(withReturnTo(`/pinned-set/${set.id}`, '/favorites') as never)}
                        onUnpin={() => setDeleteTarget({ kind: 'setGoal', id: set.id, name: setName })}
                      />
                    );
                  })}
                </View>
              );
            }
            const set = row.set;
            const year = set.releaseDate ? new Date(set.releaseDate).getFullYear() : null;
            return (
              <Pressable
                key={row.key}
                onPress={() => router.push(withReturnTo(`/pinned-set/${set.id}`, '/favorites') as never)}
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
                <Pressable
                  hitSlop={8}
                  onPress={(e) => { e.stopPropagation(); toggleGoal.mutate({ setId: set.id, currentlyPinned: false }); }}
                  style={styles.catalogRowPin}>
                  <Text style={styles.catalogRowPinText}>{t('favorites.startPin')}</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      </SlideTransition>

      <BubbleSheet
        visible={sealedSheetSet !== null}
        onClose={() => setSealedSheetSet(null)}
        tint={colors.primary}
        title={sealedSheetSet ? setFlagLabel(sealedSheetSet.name, sealedSheetSet.region) : ''}
        sizing="auto">
        <View style={{ padding: spacing.md, gap: 2 }}>
          {(() => {
            const pricesForSet = sealedSheetSet ? sealedProductPrices.get(sealedSheetSet.id) : undefined;
            const totalValue = sealedSheetSet
              ? SEALED_PRODUCT_TYPES.reduce((sum, { type }) => {
                  const qty = sealedProducts.get(sealedSheetSet.id)?.get(type) ?? 0;
                  const price = pricesForSet?.get(type);
                  return sum + (price != null ? qty * price : 0);
                }, 0)
              : 0;
            return totalValue > 0 && (
              <Text style={styles.sealedTotalValue}>
                {t('sealed.totalValue', { value: eurFormatter(locale).format(totalValue) })}
              </Text>
            );
          })()}
          {SEALED_PRODUCT_TYPES.map(({ type, labelKey }) => {
            const qty = sealedSheetSet ? (sealedProducts.get(sealedSheetSet.id)?.get(type) ?? 0) : 0;
            const unitPrice = sealedSheetSet ? sealedProductPrices.get(sealedSheetSet.id)?.get(type) : undefined;
            return (
              <View key={type} style={styles.sealedTypeRow}>
                <View>
                  <Text style={styles.sealedTypeLabel}>{t(labelKey)}</Text>
                  {unitPrice != null && (
                    <Text style={styles.sealedTypePrice}>
                      {eurFormatter(locale).format(unitPrice)}{qty > 1 ? ` × ${qty}` : ''}
                    </Text>
                  )}
                </View>
                <View style={styles.sealedQuantityPill}>
                  <Pressable
                    hitSlop={6}
                    disabled={!qty}
                    onPress={() => sealedSheetSet && adjustSealed.mutate({
                      setId: sealedSheetSet.id, setName: setFlagLabel(sealedSheetSet.name, sealedSheetSet.region),
                      productType: type, delta: -1, currentQuantity: qty,
                    })}>
                    <Ionicons name="remove-circle-outline" size={20} color={qty ? colors.textMuted : colors.border} />
                  </Pressable>
                  <Text style={styles.sealedQuantityText}>{qty}</Text>
                  <Pressable
                    hitSlop={6}
                    onPress={() => sealedSheetSet && adjustSealed.mutate({
                      setId: sealedSheetSet.id, setName: setFlagLabel(sealedSheetSet.name, sealedSheetSet.region),
                      productType: type, delta: 1, currentQuantity: qty,
                    })}>
                    <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </BubbleSheet>

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
        finishesByCardId={binderFinishesByCardId}
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

      <BubbleSheet visible={binderWizardStep === 'layout'} onClose={() => setBinderWizardStep(null)} tint={colors.primary} title={t('favorites.wizardLayoutTitle')} sizing="auto">
        <View style={styles.layoutOptions}>
          {BINDER_LAYOUTS.map((l) => (
            <Pressable
              key={l}
              onPress={() => { setWizardLayout(l); setBinderWizardStep('mode'); }}
              style={[styles.layoutOption, wizardLayout === l && styles.layoutOptionActive]}>
              <Text style={[styles.layoutOptionText, wizardLayout === l && styles.layoutOptionTextActive]}>
                {BINDER_LAYOUT_LABEL[l]}
              </Text>
            </Pressable>
          ))}
        </View>
      </BubbleSheet>

      <BubbleSheet visible={binderWizardStep === 'mode'} onClose={() => setBinderWizardStep(null)} tint={colors.primary} title={t('favorites.wizardModeTitle')} sizing="auto">
        <View style={styles.wizardBody}>
          <Pressable onPress={() => setBinderWizardStep('layout')} style={styles.wizardBackBtn}>
            <Text style={styles.wizardBackBtnText}>{t('common.back')}</Text>
          </Pressable>
          <View style={styles.chipRow}>
            <Chip label={t('favorites.wizardModeFree')} active={wizardMode === 'free'} onPress={() => setWizardMode('free')} />
            <Chip label={t('favorites.wizardModePrefill')} active={wizardMode === 'prefill'} onPress={() => setWizardMode('prefill')} />
          </View>
          <Text style={styles.wizardHint}>
            {t(wizardMode === 'free' ? 'favorites.wizardModeFreeHint' : 'favorites.wizardModePrefillHint')}
          </Text>
          {wizardMode === 'prefill' && (
            <View style={styles.chipRow}>
              <Chip
                label={t('favorites.wizardIncludeReverse')}
                active={wizardIncludeReverse}
                onPress={() => setWizardIncludeReverse(v => !v)}
              />
            </View>
          )}
          {wizardMode === 'prefill' && wizardIncludeReverse && (
            <View style={styles.chipRow}>
              <Chip
                label={t('favorites.wizardReverseTrailing')}
                active={wizardReverseMode === 'trailing'}
                onPress={() => setWizardReverseMode('trailing')}
              />
              <Chip
                label={t('favorites.wizardReverseInterleaved')}
                active={wizardReverseMode === 'interleaved'}
                onPress={() => setWizardReverseMode('interleaved')}
              />
            </View>
          )}
          <Pressable
            onPress={() => wizardMode === 'prefill' ? setBinderWizardStep('set') : finishBinderWizard()}
            disabled={createBinder.isPending}
            style={[styles.wizardBtn, createBinder.isPending && styles.wizardBtnDisabled]}>
            <Text style={styles.wizardBtnText}>{t(wizardMode === 'prefill' ? 'favorites.wizardNext' : 'favorites.wizardCreate')}</Text>
          </Pressable>
        </View>
      </BubbleSheet>

      <BubbleSheet visible={binderWizardStep === 'set'} onClose={() => setBinderWizardStep(null)} tint={colors.primary} title={t('favorites.wizardSetTitle')} sizing="standard">
        <View style={[styles.wizardBody, { flex: 1 }]}>
          <Pressable onPress={() => setBinderWizardStep('mode')} style={styles.wizardBackBtn}>
            <Text style={styles.wizardBackBtnText}>{t('common.back')}</Text>
          </Pressable>
          <TextInput
            placeholder={t('favorites.wizardSearchSetPlaceholder')}
            value={wizardSetSearch}
            onChangeText={setWizardSetSearch}
            style={styles.dupSearchInput}
          />
          {wizardFilteredSets.length === 0 ? (
            <View style={styles.center}>
              <EmptyState icon="search-outline" hint={t('favorites.noResults')} />
            </View>
          ) : (
            <FlatList
              data={wizardFilteredSets}
              contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
              keyExtractor={s => s.id}
              renderItem={({ item }) => {
                const checked = wizardSetIds.has(item.id);
                return (
                  <Pressable
                    onPress={() => setWizardSetIds(prev => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      return next;
                    })}
                    style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}>
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.primary : colors.textMuted} />
                    <Text style={styles.teamRowName} numberOfLines={1}>{setFlagLabel(item.name, item.region)}</Text>
                    <Text style={styles.teamRowCount}>{item.cardCount}</Text>
                  </Pressable>
                );
              }}
            />
          )}
          <Pressable
            onPress={finishBinderWizard}
            disabled={wizardSetIds.size === 0 || createPrefilledBinder.isPending}
            style={[styles.wizardBtn, (wizardSetIds.size === 0 || createPrefilledBinder.isPending) && styles.wizardBtnDisabled]}>
            <Text style={styles.wizardBtnText}>
              {t(wizardSetIds.size === 1 ? 'favorites.wizardCreateSetsSingular' : 'favorites.wizardCreateSetsPlural', { n: wizardSetIds.size })}
            </Text>
          </Pressable>
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
      <CaptureEffect event={completionCelebration} onDone={() => setCompletionCelebration(null)} />
      <CollectionToolsDrawer
        activeTab={isToolTab ? (subTab as ToolTab) : null}
        onSelect={(tab: ToolTab) => setSubTab(tab)}
      />
    </SafeAreaView>
  );
}
