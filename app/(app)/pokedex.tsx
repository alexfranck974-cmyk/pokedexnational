import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { useSession } from '@/lib/auth';
import { useUserDex, useOwnedCardImages, useWishedDexNums, useAllOwnedCardsDetailed, useOwnedDexNums } from '@/lib/collection';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import { withReturnTo } from '@/lib/navigation';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { PokedexSectionTabs } from '@/components/PokedexSectionTabs';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressRing } from '@/components/ProgressRing';
import { CardZoomModal } from '@/components/CardZoomModal';
import { TYPE_LABEL_FR } from '@/lib/types-colors';
import { getName } from '@/lib/i18n';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

export default function PokedexScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.md, borderRadius: radius.lg, margin: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
    },
    heroText: { flex: 1, gap: 2 },
    heroTitle: { fontSize: 13, fontFamily: fonts.display, color: 'white' },
    heroCount: { fontSize: 20, fontFamily: fonts.monoBold, color: 'white' },
    heroFilter: { fontSize: 11, fontFamily: fonts.body, color: 'rgba(255,255,255,0.8)' },
  }));
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: collectedDex = new Set<number>() } = useOwnedDexNums(userId);
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: ownedCardsDetailed = [] } = useAllOwnedCardsDetailed(userId);
  const { data: wishedInDexSet = new Set<number>() } = useWishedDexNums(userId);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const ownedCardsByDex = useMemo(() => new Map(ownedCardsDetailed.map(c => [c.dexNum, c])), [ownedCardsDetailed]);
  const { data: tcgIndex = new Map() } = useTcgIndex();
  const { data: sets = [] } = useTcgSets();
  const { data: rarities = [] } = useTcgRarities();

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState<StatusFilter>('all');
  const [typeFilter, setType]       = useState<PokemonType | null>(null);
  const [setFilter, setSet]         = useState<string | null>(null);
  const [rarityFilter, setRarity]   = useState<string | null>(null);
  const [generationFilter, setGeneration] = useState<number | null>(null);
  const [sort, setSort]             = useState<SortKey>('num-asc');
  const [columns, setColumns]       = useState<2 | 3 | 4 | null>(null);

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort,
    }, collectedDex),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort, collectedDex],
  );

  const filterHintParts: string[] = [];
  if (generationFilter) filterHintParts.push(`Gen ${generationFilter}`);
  if (typeFilter) filterHintParts.push(TYPE_LABEL_FR[typeFilter]);
  if (setFilter)  filterHintParts.push(sets.find(s => s.id === setFilter)?.name ?? setFilter);
  if (rarityFilter) filterHintParts.push(rarityFilter);
  const filterHint = filterHintParts.length ? filterHintParts.join(' + ') : undefined;

  const ownedItems = useMemo(() => items.filter(p => p.owned), [items]);
  const ownedCount = ownedItems.length;
  const pct = items.length > 0 ? Math.round((ownedCount / items.length) * 100) : 0;

  const zoomPokemon = zoomIndex !== null ? ownedItems[zoomIndex] : null;
  const zoomCard = zoomPokemon ? ownedCardsByDex.get(zoomPokemon.num) : null;
  const zoomCardImage = zoomCard ? { image_small: zoomCard.imageSmall, image_large: zoomCard.imageLarge } : null;

  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); setGeneration(null); };

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <ProgressRing pct={pct} size={56} strokeWidth={7} color="white" trackColor="rgba(255,255,255,0.25)" centerLabel={`${pct}%`} />
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Pokédex National</Text>
          <Text style={styles.heroCount}>{ownedCount} / {items.length}</Text>
          {filterHint && <Text style={styles.heroFilter}>Filtre : {filterHint}</Text>}
        </View>
      </LinearGradient>
      <PokedexSectionTabs active="pokedex" />
      <PokedexGrid
        items={items}
        ownedImages={ownedImages}
        wishedInDexSet={wishedInDexSet}
        columnsOverride={columns}
        onSelect={num => router.push(withReturnTo(wishedInDexSet.has(num) ? `/pokemon/${num}?wishes=1` : `/pokemon/${num}`, '/pokedex') as never)}
        onLongSelect={num => {
          const idx = ownedItems.findIndex(p => p.num === num);
          if (idx !== -1) setZoomIndex(idx);
        }}
      />
      <CardZoomModal
        card={zoomCardImage}
        caption={zoomPokemon ? `#${String(zoomPokemon.num).padStart(4, '0')} · ${getName(zoomPokemon)}` : undefined}
        onClose={() => setZoomIndex(null)}
        onSwipeNext={() => setZoomIndex(i => i === null || ownedItems.length === 0 ? null : (i + 1) % ownedItems.length)}
        onSwipePrev={() => setZoomIndex(i => i === null || ownedItems.length === 0 ? null : (i - 1 + ownedItems.length) % ownedItems.length)}
      />
      <SearchFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        generationFilter={generationFilter} onGeneration={setGeneration}
        sort={sort} onSort={setSort}
        sets={sets} rarities={rarities}
        onReset={reset}
        columns={columns} onColumns={setColumns}
      />
    </SafeAreaView>
  );
}
