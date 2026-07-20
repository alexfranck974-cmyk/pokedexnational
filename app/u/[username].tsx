import { useMemo, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { fetchPublicProfile } from '@/lib/auth';
import { useUserDex, useOwnedCardImages } from '@/lib/collection';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressCounter } from '@/components/ProgressCounter';
import { colors, radius, spacing, shadow } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; display_name: string; username: string } | null | 'notfound'>('notfound');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchPublicProfile(username as string)
      .then(p => { if (alive) { setProfile(p ?? 'notfound'); setChecking(false); } })
      .catch(() => { if (alive) { setProfile('notfound'); setChecking(false); } });
    return () => { alive = false; };
  }, [username]);

  const userId = typeof profile === 'object' && profile !== null ? profile.id : undefined;
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: tcgIndex = new Map() } = useTcgIndex();
  const { data: sets = [] } = useTcgSets();
  const { data: rarities = [] } = useTcgRarities();

  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState<StatusFilter>('all');
  const [typeFilter, setType]     = useState<PokemonType | null>(null);
  const [setFilter, setSet]       = useState<string | null>(null);
  const [rarityFilter, setRarity] = useState<string | null>(null);
  const [sort, setSort]           = useState<SortKey>('num-asc');

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, sort,
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, sort],
  );

  if (checking) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  if (profile === 'notfound') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.notFoundTitle}>Ce Pokédex n'existe pas ou est privé</Text>
        <Pressable style={styles.cta} onPress={() => router.push('/signup')}>
          <Text style={styles.ctaText}>Créer mon Pokédex TCG</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ownedCount = items.filter(p => p.owned).length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Pokédex TCG de {profile.display_name}</Text>
        <ProgressCounter owned={ownedCount} total={items.length} />
      </View>
      <SearchFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        sort={sort} onSort={setSort}
        sets={sets} rarities={rarities}
        onReset={() => { setStatus('all'); setType(null); setSet(null); setRarity(null); }}
      />
      <PokedexGrid items={items} ownedImages={ownedImages} onSelect={() => { /* V1: no detail from public view */ }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  banner: { padding: spacing.md, backgroundColor: colors.surface, ...shadow.sm },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.bg },
  notFoundTitle: { fontSize: 18, textAlign: 'center', fontWeight: '700', color: colors.text },
  cta: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.md },
  ctaText: { color: 'white', fontWeight: '600' },
});
