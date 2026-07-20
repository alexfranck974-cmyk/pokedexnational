import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { ProgressCounter } from '@/components/ProgressCounter';
import { TYPE_LABEL_FR } from '@/lib/types-colors';
import { colors, spacing } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

export default function PokedexScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
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
  const [sort, setSort]             = useState<SortKey>('num-asc');

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, sort,
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, sort],
  );

  const filterHintParts: string[] = [];
  if (typeFilter) filterHintParts.push(TYPE_LABEL_FR[typeFilter]);
  if (setFilter)  filterHintParts.push(sets.find(s => s.id === setFilter)?.name ?? setFilter);
  if (rarityFilter) filterHintParts.push(rarityFilter);
  const filterHint = filterHintParts.length ? filterHintParts.join(' + ') : undefined;

  const ownedCount = items.filter(p => p.owned).length;

  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); };

  return (
    <SafeAreaView style={styles.screen}>
      <SearchFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        sort={sort} onSort={setSort}
        sets={sets} rarities={rarities}
        onReset={reset}
      />
      <View style={styles.counter}>
        <ProgressCounter owned={ownedCount} total={items.length} filterHint={filterHint} />
      </View>
      <PokedexGrid
        items={items}
        ownedImages={ownedImages}
        wishedInDexSet={wishedInDexSet}
        onSelect={num => router.push(wishedInDexSet.has(num) ? `/pokemon/${num}?wishes=1` : `/pokemon/${num}`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  counter: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
