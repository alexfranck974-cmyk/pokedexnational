import { useMemo, useState, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { fetchPublicProfile } from '@/lib/auth';
import { useUserDex, useOwnedCardImages, useAllOwnedCardsDetailed, useAllWishedCards, useAllOwnedCardIds } from '@/lib/collection';
import { useShowcase } from '@/lib/favorites';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { groupWishlistByPokemon, type WishlistCard } from '@/lib/wishlist-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressCounter } from '@/components/ProgressCounter';
import { PokedexStatsSection } from '@/components/PokedexStatsSection';
import { VitrineCarousel } from '@/components/VitrineCarousel';
import { CardZoomModal, type ZoomableCard } from '@/components/CardZoomModal';
import { Pokeball } from '@/components/Pokeball';
import { getName } from '@/lib/i18n';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

type ProfileTab = 'pokedex' | 'stats' | 'wishlist';
const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'pokedex', label: 'Pokédex' },
  { key: 'stats', label: 'Statistiques' },
  { key: 'wishlist', label: 'Wishlist' },
];

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; display_name: string; username: string } | 'notfound'>('notfound');
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('pokedex');

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
  const { data: ownedCardsDetailed = [] } = useAllOwnedCardsDetailed(userId);
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const { data: tcgIndex = new Map() } = useTcgIndex();
  const { data: sets = [] } = useTcgSets();
  const { data: rarities = [] } = useTcgRarities();
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  // Grid taps zoom a single card; Vitrine taps zoom into the curated list and
  // support swiping to the next/previous showcased card without closing.
  const [zoom, setZoom] = useState<{ kind: 'grid'; card: ZoomableCard } | { kind: 'vitrine'; index: number } | null>(null);

  const ownedCardsByDex = useMemo(() => new Map(ownedCardsDetailed.map(c => [c.dexNum, c])), [ownedCardsDetailed]);
  const vitrineCards = useMemo(() => Array.from(showcase)
    .map(dexNum => ownedCardsByDex.get(dexNum))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .slice(0, 6), [showcase, ownedCardsByDex]);
  const vitrineItems = useMemo(() => vitrineCards.map((c, i) => ({
    key: c.cardId,
    image: c.imageLarge ?? c.imageSmall,
    onPress: () => setZoom({ kind: 'vitrine', index: i }),
  })), [vitrineCards]);

  const activeZoomCard: ZoomableCard | null =
    zoom?.kind === 'grid' ? zoom.card
    : zoom?.kind === 'vitrine' ? { image_small: vitrineCards[zoom.index].imageSmall, image_large: vitrineCards[zoom.index].imageLarge }
    : null;

  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState<StatusFilter>('all');
  const [typeFilter, setType]     = useState<PokemonType | null>(null);
  const [setFilter, setSet]       = useState<string | null>(null);
  const [rarityFilter, setRarity] = useState<string | null>(null);
  const [generationFilter, setGeneration] = useState<number | null>(null);
  const [sort, setSort]           = useState<SortKey>('num-asc');
  const [columns, setColumns]     = useState<2 | 3 | 4 | null>(null);

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort,
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort],
  );

  const wishlistGroups = useMemo(
    () => groupWishlistByPokemon(wishedCards as WishlistCard[], ownedCardIds),
    [wishedCards, ownedCardIds],
  );

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    banner: { padding: spacing.md, backgroundColor: colors.surface, ...shadow.sm },
    bannerTitle: { fontSize: 20, fontFamily: fonts.display, color: colors.text },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.bg },
    notFoundTitle: { fontSize: 18, textAlign: 'center' as const, fontFamily: fonts.display, color: colors.text },
    cta: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.md },
    ctaText: { color: 'white', fontFamily: fonts.bodyBold },

    tabRow: {
      flexDirection: 'row' as const, gap: spacing.xs, padding: spacing.sm,
      backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    tabBtnActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    tabTextActive: { color: 'white' },

    statsScroll: { padding: spacing.lg, gap: spacing.lg },
    wishlistScroll: { padding: spacing.md },
    empty: { fontSize: 14, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, textAlign: 'center' as const, marginTop: spacing.xl },

    pokemonRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface,
      borderLeftWidth: 3, borderLeftColor: 'transparent',
    },
    pokemonRowOwned: { borderLeftColor: colors.success },
    pokemonSpriteWrap: { width: 40, height: 40, position: 'relative' as const },
    pokemonSprite: { width: 40, height: 40 },
    pokemonOwnedBadge: {
      position: 'absolute' as const, bottom: -2, right: -2, backgroundColor: colors.surface,
      borderRadius: radius.pill, padding: 1, ...shadow.sm,
    },
    pokemonInfo: { flex: 1, gap: 2 },
    pokemonName: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    pokemonSub: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    pokemonThumbs: { maxWidth: 120, flexGrow: 0 },
    pokemonThumbWrap: { borderRadius: radius.sm, marginRight: 4 },
    pokemonThumbWrapOwned: { borderWidth: 1.5, borderColor: colors.success },
    pokemonThumb: { width: 28, height: 40 },
  }));

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

      <VitrineCarousel items={vitrineItems} />

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'pokedex' && (
        <>
          <PokedexGrid
            items={items}
            ownedImages={ownedImages}
            columnsOverride={columns}
            onSelect={(num) => {
              const card = ownedCardsByDex.get(num);
              if (card) setZoom({ kind: 'grid', card: { image_small: card.imageSmall, image_large: card.imageLarge } });
            }}
            onLongSelect={(num) => {
              const card = ownedCardsByDex.get(num);
              if (card) setZoom({ kind: 'grid', card: { image_small: card.imageSmall, image_large: card.imageLarge } });
            }}
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
            onReset={() => { setStatus('all'); setType(null); setSet(null); setRarity(null); setGeneration(null); }}
            columns={columns} onColumns={setColumns}
          />
        </>
      )}

      {tab === 'stats' && (
        <ScrollView contentContainerStyle={styles.statsScroll}>
          <PokedexStatsSection userId={userId} showValueBadges={false} />
        </ScrollView>
      )}

      {tab === 'wishlist' && (
        <ScrollView contentContainerStyle={styles.wishlistScroll}>
          {wishlistGroups.length === 0 ? (
            <Text style={styles.empty}>Aucune carte dans la wishlist.</Text>
          ) : (
            wishlistGroups.map(group => {
              const mon = POKEDEX_BY_DEX.get(group.dexNum);
              const groupOwnedCount = group.cards.filter(c => ownedCardIds.has(c.id)).length;
              return (
                <View key={group.dexNum} style={[styles.pokemonRow, groupOwnedCount > 0 && styles.pokemonRowOwned]}>
                  <View style={styles.pokemonSpriteWrap}>
                    {mon && <Image source={{ uri: mon.sprite_url }} style={styles.pokemonSprite} resizeMode="contain" />}
                    {groupOwnedCount > 0 && <View style={styles.pokemonOwnedBadge}><Pokeball size={13} /></View>}
                  </View>
                  <View style={styles.pokemonInfo}>
                    <Text style={styles.pokemonName} numberOfLines={1}>
                      #{String(group.dexNum).padStart(4, '0')} · {mon ? getName(mon) : group.dexNum}
                    </Text>
                    <Text style={styles.pokemonSub}>
                      {group.cards.length} carte{group.cards.length > 1 ? 's' : ''} en wishlist
                      {groupOwnedCount > 0 ? ` · ${groupOwnedCount} déjà possédée${groupOwnedCount > 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pokemonThumbs}>
                    {group.cards.slice(0, 4).map(c => (
                      <View key={c.id} style={[styles.pokemonThumbWrap, ownedCardIds.has(c.id) && styles.pokemonThumbWrapOwned]}>
                        <Image source={{ uri: c.image_small }} style={styles.pokemonThumb} resizeMode="contain" />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      <CardZoomModal
        card={activeZoomCard}
        onClose={() => setZoom(null)}
        onSwipeNext={zoom?.kind === 'vitrine' ? () => setZoom({ kind: 'vitrine', index: (zoom.index + 1) % vitrineCards.length }) : undefined}
        onSwipePrev={zoom?.kind === 'vitrine' ? () => setZoom({ kind: 'vitrine', index: (zoom.index - 1 + vitrineCards.length) % vitrineCards.length }) : undefined}
      />
    </SafeAreaView>
  );
}
