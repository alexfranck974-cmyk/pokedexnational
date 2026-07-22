import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { TypeBadge } from '@/components/TypeBadge';
import { CardGallery } from '@/components/CardGallery';
import { CardFilterTree } from '@/components/CardFilterTree';
import { CardZoomModal } from '@/components/CardZoomModal';
import type { TcgCardRow } from '@/lib/tcg';
import { useCardsForPokemon } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import { useUserCards, useUserWishlist, useToggleCard, useToggleWish, useCardAcquiredAt } from '@/lib/collection';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

const REGIONS: { id: 'global' | 'jp' | 'cn'; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'cn', label: 'Chinois' },
  { id: 'jp', label: 'Japonais' },
];

export default function PokemonDetail() {
  const { num: numStr, wishes } = useLocalSearchParams<{ num: string; wishes?: string }>();
  const router = useRouter();
  const num = parseInt(numStr as string, 10);
  const p = POKEDEX.find(x => x.num === num);
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: cards = [], isLoading: cardsLoading } = useCardsForPokemon(num);
  const { data: ownedSet = new Set<string>() } = useUserCards(userId, num);
  const { data: wishedSet = new Set<string>() } = useUserWishlist(userId, num);
  const { data: acquiredAt } = useCardAcquiredAt(userId, num);
  const toggle = useToggleCard();
  const toggleWish = useToggleWish();

  const [region, setRegion] = useState<'global' | 'jp' | 'cn'>('global');
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string> | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onlyWishes, setOnlyWishes] = useState(wishes === '1');
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);

  // Prev/next reuses this same route (router.replace), so reset per-Pokémon transient
  // filters/state on num change — viewMode is kept as a persistent user preference.
  useEffect(() => {
    setSelectedSetIds(null);
    setOnlyWishes(wishes === '1');
    setZoomCard(null);
  }, [num]);

  // Sets differ per region — clear the set filter when switching region to avoid a
  // stale selection silently hiding every card.
  useEffect(() => { setSelectedSetIds(null); }, [region]);

  const prevNum = num > 1 ? num - 1 : POKEDEX.length;
  const nextNum = num < POKEDEX.length ? num + 1 : 1;
  const goTo = (n: number) => router.replace(`/pokemon/${n}`);

  const regionCards = useMemo(() => cards.filter(c => c.region === region), [cards, region]);

  const filteredCards = useMemo(
    () => selectedSetIds === null ? regionCards : regionCards.filter(c => selectedSetIds.has(c.set_id)),
    [regionCards, selectedSetIds],
  );

  const wishFiltered = onlyWishes ? filteredCards.filter(c => wishedSet.has(c.id)) : filteredCards;

  const sortedCards = useMemo(() => {
    const wished: typeof wishFiltered = [];
    const rest: typeof wishFiltered = [];
    for (const c of wishFiltered) {
      if (wishedSet.has(c.id)) wished.push(c);
      else rest.push(c);
    }
    return [...wished, ...rest];
  }, [wishFiltered, wishedSet]);

  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: { padding: spacing.md, backgroundColor: colors.surface, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, ...shadow.sm },
    back: { padding: 4 },
    backText: { color: colors.primary, fontSize: 14, fontFamily: fonts.body },
    miniSprite: { width: 40, height: 40 },
    title: { fontSize: 17, fontFamily: fonts.display, color: colors.text },
    typesRow: { marginTop: 2 },
    count: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted, paddingLeft: 4 },
    acquiredAt: { fontSize: 10, fontFamily: fonts.body, color: colors.textDim, paddingLeft: 4 },
    viewBtn: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surfaceAlt },
    viewBtnActive: { backgroundColor: colors.primary },
    viewBtnText: { fontSize: 16, color: colors.textMuted },
    viewBtnTextActive: { color: 'white' },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: 24, fontStyle: 'italic' as const },
    regionRow: { flexDirection: 'row' as const, gap: spacing.xs, padding: spacing.sm, paddingBottom: 0 },
    regionChip: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    regionChipActive: { backgroundColor: colors.primary },
    regionChipText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    regionChipTextActive: { color: 'white' },
    wishBanner: { padding: spacing.sm, backgroundColor: colors.dangerBg, marginHorizontal: spacing.md, borderRadius: radius.md, marginBottom: 6 },
    wishBannerText: { color: colors.danger, fontSize: 12, textAlign: 'center' as const, fontFamily: fonts.bodyBold },

    navOverlay: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 },
    navBtn: {
      position: 'absolute' as const, top: '50%' as const, marginTop: -22, width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: 0.92, ...shadow.md,
    },
    navBtnLeft: { left: spacing.sm },
    navBtnRight: { right: spacing.sm },
  }));

  if (!p) return <SafeAreaView><Text>Pokémon inconnu</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/pokedex')} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </Pressable>
        <Image source={{ uri: p.sprite_url }} style={styles.miniSprite} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>#{String(p.num).padStart(4, '0')} · {getName(p)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesRow} contentContainerStyle={{ gap: 6 }}>
            {p.types.map(t => <TypeBadge key={t} type={t} />)}
          </ScrollView>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.count}>{ownedSet.size} / {filteredCards.length}</Text>
          {acquiredAt && (
            <Text style={styles.acquiredAt}>Ajoutée le {new Date(acquiredAt).toLocaleDateString('fr-FR')}</Text>
          )}
        </View>
        <Pressable
          onPress={() => setViewMode('grid')}
          style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}>
          <Text style={[styles.viewBtnText, viewMode === 'grid' && styles.viewBtnTextActive]}>⊞</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('list')}
          style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}>
          <Text style={[styles.viewBtnText, viewMode === 'list' && styles.viewBtnTextActive]}>☰</Text>
        </Pressable>
      </View>

      <View style={styles.regionRow}>
        {REGIONS.map(r => (
          <Pressable
            key={r.id}
            onPress={() => setRegion(r.id)}
            style={[styles.regionChip, region === r.id && styles.regionChipActive]}>
            <Text style={[styles.regionChipText, region === r.id && styles.regionChipTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <Text style={styles.empty}>Aucune carte TCG connue pour ce Pokémon dans la base.</Text>
      ) : regionCards.length === 0 ? (
        <Text style={styles.empty}>Aucune carte {REGIONS.find(r => r.id === region)?.label} connue pour ce Pokémon.</Text>
      ) : (
        <>
          <CardFilterTree
            cards={regionCards}
            selectedSetIds={selectedSetIds}
            onChange={setSelectedSetIds}
          />
          {onlyWishes && (
            <Pressable onPress={() => setOnlyWishes(false)} style={styles.wishBanner}>
              <Text style={styles.wishBannerText}>♥ Filtre wish actif — tap pour tout voir</Text>
            </Pressable>
          )}
          {sortedCards.length === 0 ? (
            <Text style={styles.empty}>Aucune carte dans les extensions sélectionnées.</Text>
          ) : (
            <CardGallery
              cards={sortedCards}
              ownedSet={ownedSet}
              wishedSet={wishedSet}
              viewMode={viewMode}
              onToggle={c => toggle.mutate({ cardId: c.id, currentlyOwned: ownedSet.has(c.id), dexNum: num, imageSmall: c.image_small })}
              onToggleWish={c => toggleWish.mutate({ cardId: c.id, currentlyWished: wishedSet.has(c.id), dexNum: num })}
              onLongPress={c => setZoomCard(c)}
            />
          )}
        </>
      )}
      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />

      <View style={styles.navOverlay} pointerEvents="box-none">
        <Pressable onPress={() => goTo(prevNum)} style={[styles.navBtn, styles.navBtnLeft]} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => goTo(nextNum)} style={[styles.navBtn, styles.navBtnRight]} hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
