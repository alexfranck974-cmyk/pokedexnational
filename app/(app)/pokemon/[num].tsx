import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ActivityIndicator, Pressable, ScrollView, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

const REGIONS: { id: 'global' | 'jp' | 'cn'; label: string; emoji: string }[] = [
  { id: 'global', label: 'Global', emoji: '🌍' },
  { id: 'cn', label: 'Chinois', emoji: '🇨🇳' },
  { id: 'jp', label: 'Japonais', emoji: '🇯🇵' },
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

  // Swipe left/right anywhere on the screen to browse the National Pokédex —
  // the arrow buttons below stay as a discoverable bonus, not the only way in.
  // Only claims the gesture once a drag is clearly horizontal, so it doesn't
  // fight vertical scrolling or the type-badges' own horizontal ScrollView.
  const swipeNav = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -60) goTo(nextNum);
        else if (g.dx >= 60) goTo(prevNum);
      },
    }),
    [nextNum, prevNum],
  );

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
    // userSelect:none stops a swipe from turning into a native text-drag-select
    // on web, which would otherwise eat the gesture before our PanResponder sees it.
    screen: { flex: 1, backgroundColor: colors.bg, userSelect: 'none' as const },
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
    heroMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heroSprite: { width: 64, height: 64 },
    heroDex: { fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.75)' },
    heroName: { fontSize: 20, fontFamily: fonts.display, color: 'white' },
    heroCount: { fontSize: 16, fontFamily: fonts.monoBold, color: 'white' },
    heroAcquired: { fontSize: 10, fontFamily: fonts.body, color: 'rgba(255,255,255,0.7)' },
    empty: { textAlign: 'center' as const, fontFamily: fonts.body, color: colors.textMuted, padding: 24, fontStyle: 'italic' as const },
    regionRow: { flexDirection: 'row' as const, gap: spacing.xs, padding: spacing.sm, paddingBottom: 0 },
    regionChip: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    regionChipActive: { backgroundColor: colors.primary },
    regionChipText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    regionChipTextActive: { color: 'white' },
    wishBannerRow: { alignItems: 'center' as const, marginBottom: 6 },
    wishBanner: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: spacing.md, paddingVertical: 6,
      backgroundColor: colors.dangerBg, borderRadius: radius.pill,
    },
    wishBannerText: { color: colors.danger, fontSize: 12, fontFamily: fonts.bodyBold },

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
    <SafeAreaView style={styles.screen} {...swipeNav.panHandlers}>
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={() => router.replace('/pokedex')} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color="white" />
            <Text style={styles.backText}>Pokédex</Text>
          </Pressable>
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
        </View>
        <View style={styles.heroMain}>
          <Image source={{ uri: p.sprite_url }} style={styles.heroSprite} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDex}>#{String(p.num).padStart(4, '0')}</Text>
            <Text style={styles.heroName}>{getName(p)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
              {p.types.map(t => <TypeBadge key={t} type={t} />)}
            </ScrollView>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroCount}>{ownedSet.size} / {filteredCards.length}</Text>
            {acquiredAt && (
              <Text style={styles.heroAcquired}>Ajoutée le {new Date(acquiredAt).toLocaleDateString('fr-FR')}</Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.regionRow}>
        {REGIONS.map(r => (
          <Pressable
            key={r.id}
            onPress={() => setRegion(r.id)}
            style={[styles.regionChip, region === r.id && styles.regionChipActive]}>
            <Text style={[styles.regionChipText, region === r.id && styles.regionChipTextActive]}>{r.emoji} {r.label}</Text>
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
            <View style={styles.wishBannerRow}>
              <Pressable onPress={() => setOnlyWishes(false)} style={styles.wishBanner}>
                <Text style={styles.wishBannerText}>♥ Filtre wish actif — tap pour tout voir</Text>
              </Pressable>
            </View>
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
