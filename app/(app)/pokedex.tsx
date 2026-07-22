import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { useSession } from '@/lib/auth';
import { useUserDex, useOwnedCardImages, useWishedDexNums } from '@/lib/collection';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressRing } from '@/components/ProgressRing';
import { TYPE_LABEL_FR } from '@/lib/types-colors';
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
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: wishedInDexSet = new Set<number>() } = useWishedDexNums(userId);
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
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort],
  );

  const filterHintParts: string[] = [];
  if (generationFilter) filterHintParts.push(`Gen ${generationFilter}`);
  if (typeFilter) filterHintParts.push(TYPE_LABEL_FR[typeFilter]);
  if (setFilter)  filterHintParts.push(sets.find(s => s.id === setFilter)?.name ?? setFilter);
  if (rarityFilter) filterHintParts.push(rarityFilter);
  const filterHint = filterHintParts.length ? filterHintParts.join(' + ') : undefined;

  const ownedCount = items.filter(p => p.owned).length;
  const pct = items.length > 0 ? Math.round((ownedCount / items.length) * 100) : 0;

  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); setGeneration(null); };

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable onPress={() => router.push('/dashboard')}>
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
      </Pressable>
      <PokedexGrid
        items={items}
        ownedImages={ownedImages}
        wishedInDexSet={wishedInDexSet}
        columnsOverride={columns}
        onSelect={num => router.push(wishedInDexSet.has(num) ? `/pokemon/${num}?wishes=1` : `/pokemon/${num}`)}
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
