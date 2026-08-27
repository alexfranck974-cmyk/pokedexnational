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
import { CardCopySheet, EditCopyFooterButton } from '@/components/CardCopySheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { TYPE_COLORS } from '@/lib/types-colors';
import { withAlpha } from '@/lib/color-utils';
import type { TcgCardRow } from '@/lib/tcg';
import { useCardsForPokemon } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import {
  useUserCards, useLedgerCardsForDex, useUserWishlist, useToggleCard, useToggleWish, useCardAcquiredAt,
  useOwnedCardQuantities, useAdjustOwnedCardQuantity, useOwnedCardFinishes,
} from '@/lib/collection';
import { useFavorites, useToggleFavorite, useShowcase, useToggleShowcase, VITRINE_LIMIT } from '@/lib/favorites';
import { toast } from '@/lib/toast';
import { useBackTo, withReturnTo, safeDecodeURIComponent } from '@/lib/navigation';
import { useHistoryBackGuard } from '@/lib/history-back-guard';
import { useLocale, useT } from '@/lib/locale';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { BackButton } from '@/components/BackButton';

const POKEDEX = pokedexData as Pokemon[];

// Per-Pokémon colored glow on the hero sprite (primary type) — dynamic per
// screen instance, same pattern as the Pokedex grid's generation headers.
function shadowGlow(color: string) {
  return {
    shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10,
    elevation: 6,
  };
}

export default function PokemonDetail() {
  const { num: numStr, wishes, from } = useLocalSearchParams<{ num: string; wishes?: string; from?: string }>();
  const router = useRouter();
  const num = parseInt(numStr as string, 10);
  const p = POKEDEX.find(x => x.num === num);
  const { session } = useSession();
  const userId = session?.user.id;
  const { locale } = useLocale();
  const t = useT();
  const REGIONS: { id: 'global' | 'jp' | 'cn'; label: string; emoji: string }[] = [
    { id: 'global', label: t('pokemon.regionGlobal'), emoji: '🌍' },
    { id: 'cn', label: t('pokemon.regionChinese'), emoji: '🇨🇳' },
    { id: 'jp', label: t('pokemon.regionJapanese'), emoji: '🇯🇵' },
  ];
  const { data: cards = [], isLoading: cardsLoading } = useCardsForPokemon(num);
  // officialSet drives tap semantics (choose/unchoose the National Dex card) and stays
  // exactly as before; ledgerSet drives the lock icon so every owned printing shows
  // unlocked, not just the one currently chosen as official.
  const { data: officialSet = new Set<string>() } = useUserCards(userId, num);
  const { data: ledgerSet = new Set<string>() } = useLedgerCardsForDex(userId, num);
  const { data: wishedSet = new Set<string>() } = useUserWishlist(userId, num);
  const { data: acquiredAt } = useCardAcquiredAt(userId, num);
  const toggle = useToggleCard();
  const toggleWish = useToggleWish();
  const { data: quantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: finishesByCard } = useOwnedCardFinishes(userId);
  const adjustQuantity = useAdjustOwnedCardQuantity();
  const { data: favorites = new Set<number>() } = useFavorites(userId);
  const toggleFavorite = useToggleFavorite();
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const toggleShowcase = useToggleShowcase();
  const isFavorited = favorites.has(num);
  const isInShowcase = showcase.has(num);
  const handleToggleShowcase = () => {
    if (!isInShowcase && showcase.size >= VITRINE_LIMIT) {
      toast(t('pokemon.showcaseLimitToast', { n: VITRINE_LIMIT }));
      return;
    }
    toggleShowcase.mutate({ dexNum: num, currentlyFavorited: isFavorited, currentlyInShowcase: isInShowcase });
  };

  const [region, setRegion] = useState<'global' | 'jp' | 'cn'>('global');
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string> | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onlyWishes, setOnlyWishes] = useState(wishes === '1');
  const [zoomCard, setZoomCard] = useState<TcgCardRow | null>(null);
  const [pendingCard, setPendingCard] = useState<TcgCardRow | null>(null);
  const [detailsCard, setDetailsCard] = useState<TcgCardRow | null>(null);
  // Set only when this dex_num had no official card before this visit and just
  // got one — a genuinely new National Dex entry, not swapping an already-owned
  // Pokémon's chosen printing. Carried through the back navigation so pokedex.tsx
  // can play the "new card" celebration on arrival (see lib/navigation.ts).
  const [justCapturedDex, setJustCapturedDex] = useState<number | null>(null);
  const goBack = useBackTo('/pokedex', justCapturedDex != null ? { newCard: String(justCapturedDex) } : undefined);

  // See lib/history-back-guard.ts for why this is needed and why it's capped
  // to one shared guard instead of pushing a fresh history entry per screen.
  useHistoryBackGuard(goBack);

  // Prev/next reuses this same route (router.replace), so reset per-Pokémon transient
  // filters/state on num change — viewMode is kept as a persistent user preference.
  useEffect(() => {
    setSelectedSetIds(null);
    setOnlyWishes(wishes === '1');
    setZoomCard(null);
    setPendingCard(null);
    setDetailsCard(null);
    setJustCapturedDex(null);
  }, [num]);

  // Sets differ per region — clear the set filter when switching region to avoid a
  // stale selection silently hiding every card.
  useEffect(() => { setSelectedSetIds(null); }, [region]);

  const prevNum = num > 1 ? num - 1 : POKEDEX.length;
  const nextNum = num < POKEDEX.length ? num + 1 : 1;
  // Carry the origin (`from`) forward across swipes so "Retour" still returns
  // to wherever the user originally entered this screen from, not the default.
  const goTo = (n: number) => router.replace((from ? withReturnTo(`/pokemon/${n}`, safeDecodeURIComponent(from)) : `/pokemon/${n}`) as never);

  // Swipe left/right anywhere on the screen to browse the National Pokédex —
  // the arrow buttons below stay as a discoverable bonus, not the only way in.
  // Only claims the gesture once a drag is clearly horizontal, so it doesn't
  // fight vertical scrolling or the type-badges' own horizontal ScrollView.
  // A rightward drag starting right at the left edge is left alone (never
  // claimed here) so iOS's native edge-swipe-to-go-back gesture — which starts
  // from that exact same zone — isn't raced by this PanResponder also firing
  // a router.replace() mid-transition (that combination crashed the app).
  const EDGE_GESTURE_ZONE = 30;
  const swipeNav = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (g.dx > 0 && g.x0 < EDGE_GESTURE_ZONE) return false;
        return Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
      },
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

  const { colors, heroGradient, heroText, heroTextMuted, heroSurface, heroSurfaceActive, heroSurfaceActiveText } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    // userSelect:none stops a swipe from turning into a native text-drag-select
    // on web, which would otherwise eat the gesture before our PanResponder sees it.
    screen: { flex: 1, backgroundColor: colors.bg, userSelect: 'none' as const },
    hero: { padding: spacing.md, gap: spacing.sm, ...shadow.sm },
    heroTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: heroText, fontSize: 14, fontFamily: fonts.body },
    heroViewToggle: { flexDirection: 'row' as const, gap: 6 },
    viewBtn: {
      width: 30, height: 30, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: heroSurface,
    },
    viewBtnActive: { backgroundColor: heroSurfaceActive },
    heroToggleDivider: { width: 1, alignSelf: 'stretch' as const, backgroundColor: heroSurface, marginHorizontal: 2 },
    heroMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heroSpriteWrap: {
      width: 92, height: 92, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heroSpriteGlow: { position: 'absolute' as const, width: 92, height: 92, borderRadius: 46 },
    heroSprite: { width: 84, height: 84 },
    heroDex: { fontSize: 12, fontFamily: fonts.mono, color: heroTextMuted },
    heroName: { fontSize: 20, fontFamily: fonts.display, color: heroText },
    heroCount: { fontSize: 16, fontFamily: fonts.monoBold, color: heroText },
    heroAcquired: { fontSize: 10, fontFamily: fonts.body, color: heroTextMuted },
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
    infoBanner: {
      flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8,
      marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm,
      backgroundColor: colors.primarySoft, borderRadius: radius.md,
    },
    infoBannerText: { flex: 1, fontSize: 11, fontFamily: fonts.body, color: colors.text, lineHeight: 15 },

    navOverlay: { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 },
    navBtn: {
      position: 'absolute' as const, top: '50%' as const, marginTop: -22, width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: 0.92, ...shadow.md,
    },
    navBtnLeft: { left: spacing.sm },
    navBtnRight: { right: spacing.sm },
  }));

  if (!p) return <SafeAreaView><Text>{t('pokemon.notFound')}</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen} {...swipeNav.panHandlers}>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTopRow}>
          <BackButton onPress={goBack} color={heroText} size={18} label style={styles.back} textStyle={styles.backText} />
          <View style={styles.heroViewToggle}>
            <Pressable
              onPress={() => toggleFavorite.mutate({ dexNum: num, currentlyFavorited: isFavorited })}
              style={[styles.viewBtn, isFavorited && styles.viewBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={t(isFavorited ? 'pokemon.a11yUnfavorite' : 'pokemon.a11yFavorite')}>
              <Ionicons name={isFavorited ? 'star' : 'star-outline'} size={15} color={isFavorited ? heroSurfaceActiveText : heroText} />
            </Pressable>
            <Pressable
              onPress={handleToggleShowcase}
              style={[styles.viewBtn, isInShowcase && styles.viewBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={t(isInShowcase ? 'pokemon.a11yUnshowcase' : 'pokemon.a11yShowcase')}>
              <Ionicons name={isInShowcase ? 'sparkles' : 'sparkles-outline'} size={15} color={isInShowcase ? heroSurfaceActiveText : heroText} />
            </Pressable>
            <View style={styles.heroToggleDivider} />
            <Pressable
              onPress={() => setViewMode('grid')}
              style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={t('trainers.a11yGridView')}>
              <Ionicons name="grid" size={15} color={viewMode === 'grid' ? heroSurfaceActiveText : heroText} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={t('trainers.a11yListView')}>
              <Ionicons name="list" size={15} color={viewMode === 'list' ? heroSurfaceActiveText : heroText} />
            </Pressable>
          </View>
        </View>
        <View style={styles.heroMain}>
          <View style={styles.heroSpriteWrap}>
            <View style={[styles.heroSpriteGlow, { backgroundColor: withAlpha(TYPE_COLORS[p.types[0]] ?? '#888888', 0.35) }]} />
            <Image
              source={{ uri: p.sprite_url }}
              style={[styles.heroSprite, shadowGlow(TYPE_COLORS[p.types[0]] ?? '#888888')]}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDex}>#{String(p.num).padStart(4, '0')}</Text>
            <Text style={styles.heroName}>{getName(p, locale)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
              {p.types.map(t => <TypeBadge key={t} type={t} />)}
            </ScrollView>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroCount}>{ledgerSet.size} / {filteredCards.length}</Text>
            {acquiredAt && (
              <Text style={styles.heroAcquired}>{t('pokemon.addedOn', { date: new Date(acquiredAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR') })}</Text>
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
        <EmptyState icon="albums-outline" hint={t('pokemon.noCardsKnown')} />
      ) : regionCards.length === 0 ? (
        <EmptyState icon="albums-outline" hint={t('pokemon.noRegionCards', { region: REGIONS.find(r => r.id === region)?.label ?? '' })} />
      ) : (
        <>
          <CardFilterTree
            cards={regionCards}
            selectedSetIds={selectedSetIds}
            onChange={setSelectedSetIds}
            onOpenSet={setId => {
              // Carry the ORIGINAL origin forward too, not just "back to this
              // Pokemon" — otherwise a second "Retour" from the extension
              // screen lands on a bare pokemon/[num] with no `from` of its
              // own, falling through to its hardcoded default instead of
              // wherever this screen was actually entered from.
              const pokemonUrl = from ? withReturnTo(`/pokemon/${num}`, safeDecodeURIComponent(from)) : `/pokemon/${num}`;
              router.push(withReturnTo(`/pinned-set/${setId}`, pokemonUrl) as never);
            }}
          />
          {onlyWishes && (
            <View style={styles.wishBannerRow}>
              <Pressable onPress={() => setOnlyWishes(false)} style={styles.wishBanner}>
                <Text style={styles.wishBannerText}>{t('pokemon.wishFilterActive')}</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={16} color={colors.primary} />
            <Text style={styles.infoBannerText}>{t('pokemon.infoBanner')}</Text>
          </View>
          {sortedCards.length === 0 ? (
            <EmptyState icon="filter-outline" hint={t('pokemon.noCardsInSelectedSets')} />
          ) : (
            <CardGallery
              cards={sortedCards}
              ownedSet={ledgerSet}
              wishedSet={wishedSet}
              dexCardId={[...officialSet][0]}
              viewMode={viewMode}
              quantities={quantities}
              onIncrement={c => adjustQuantity.mutate({ cardId: c.id, delta: 1, currentQuantity: quantities.get(c.id) ?? 0, rarity: c.rarity })}
              onDecrement={c => adjustQuantity.mutate({ cardId: c.id, delta: -1, currentQuantity: quantities.get(c.id) ?? 0 })}
              onToggle={c => {
                if (officialSet.has(c.id)) {
                  // Un-choosing is the one unambiguous action here — stays instant.
                  toggle.mutate({ cardId: c.id, currentlyOwned: true, dexNum: num, imageSmall: c.image_small, rarity: c.rarity });
                } else {
                  setPendingCard(c);
                }
              }}
              onToggleWish={c => toggleWish.mutate({ cardId: c.id, currentlyWished: wishedSet.has(c.id), dexNum: num })}
              onZoom={c => setZoomCard(c)}
              onOpenDetails={c => setDetailsCard(c)}
              finishesByCard={finishesByCard}
            />
          )}
        </>
      )}
      <CardZoomModal
        card={zoomCard}
        onClose={() => setZoomCard(null)}
        footer={zoomCard && ledgerSet.has(zoomCard.id) ? (
          <EditCopyFooterButton onPress={() => { setDetailsCard(zoomCard); setZoomCard(null); }} />
        ) : undefined}
      />
      <CardCopySheet card={detailsCard} onClose={() => setDetailsCard(null)} />
      <ConfirmDialog
        target={pendingCard ? {
          title: t('pokemon.chooseCardTitle'),
          message: t('pokemon.chooseCardMessage', { cardName: pendingCard.name, pokemonName: getName(p, locale) }),
        } : null}
        confirmLabel={t('common.choose')}
        cancelLabel={t('common.cancel')}
        tone="primary"
        onConfirm={() => {
          if (pendingCard) {
            const isNewDexEntry = officialSet.size === 0;
            toggle.mutate(
              { cardId: pendingCard.id, currentlyOwned: false, dexNum: num, imageSmall: pendingCard.image_small, rarity: pendingCard.rarity },
              { onSuccess: () => { if (isNewDexEntry) setJustCapturedDex(num); } },
            );
          }
          setPendingCard(null);
        }}
        onCancel={() => setPendingCard(null)}
      />

      <View style={styles.navOverlay} pointerEvents="box-none">
        <Pressable onPress={() => goTo(prevNum)} style={[styles.navBtn, styles.navBtnLeft]} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('pokemon.a11yPrev')}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => goTo(nextNum)} style={[styles.navBtn, styles.navBtnRight]} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('pokemon.a11yNext')}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
