import { useMemo, useState, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { fetchPublicProfile, useSession } from '@/lib/auth';
import { useUserDex, useOwnedCardImages, useAllOwnedCardsDetailed, useAllOwnedCardsLedgerDetailed, useAllWishedCards, useAllOwnedCardIds } from '@/lib/collection';
import { useShowcase } from '@/lib/favorites';
import { useSetGoals } from '@/lib/collection-goals';
import { useFriendshipStatus, useSendFriendRequest, useAcceptFriendRequest, useRemoveFriendship } from '@/lib/friends';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { groupWishlistByPokemon, type WishlistCard } from '@/lib/wishlist-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressCounter } from '@/components/ProgressCounter';
import { PokedexStatsSection } from '@/components/PokedexStatsSection';
import { VitrineCarousel } from '@/components/VitrineCarousel';
import { SetGoalTile } from '@/components/SetGoalTile';
import { FriendSetGalleryModal, type FriendSetGalleryTarget } from '@/components/FriendSetGalleryModal';
import { CardZoomModal, type ZoomableCard } from '@/components/CardZoomModal';
import { TradeProposalModal, type TradeTarget, type PickedCard } from '@/components/TradeProposalModal';
import { TradeIcon } from '@/components/TradeIcon';
import { BubbleSheet } from '@/components/BubbleSheet';
import { Pokeball } from '@/components/Pokeball';
import { IconBubble } from '@/components/IconBubble';
import { getName } from '@/lib/i18n';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useBackTo } from '@/lib/navigation';
import { TabBarVisibilityProvider } from '@/lib/tab-bar-visibility';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { useLocale, useT } from '@/lib/locale';
import type { StringKey } from '@/lib/strings';

const POKEDEX = pokedexData as Pokemon[];
const POKEDEX_BY_DEX = new Map<number, Pokemon>(POKEDEX.map(p => [p.num, p]));

type ProfileTab = 'stats' | 'collection' | 'wishlist';
const TABS: { key: ProfileTab; labelKey: StringKey }[] = [
  { key: 'stats', labelKey: 'statsTabs.title' },
  { key: 'collection', labelKey: 'tabs.collection' },
  { key: 'wishlist', labelKey: 'tabs.wishlist' },
];

export default function PublicProfile() {
  return (
    <TabBarVisibilityProvider>
      <PublicProfileInner />
    </TabBarVisibilityProvider>
  );
}

function PublicProfileInner() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const goBack = useBackTo('/friends');
  const { locale } = useLocale();
  const t = useT();
  const { session } = useSession();
  const viewerId = session?.user.id;
  const [profile, setProfile] = useState<{ id: string; display_name: string; username: string } | 'notfound'>('notfound');
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<ProfileTab>('stats');

  useEffect(() => {
    let alive = true;
    setChecking(true);
    fetchPublicProfile(username as string, viewerId)
      .then(p => { if (alive) { setProfile(p ?? 'notfound'); setChecking(false); } })
      .catch(() => { if (alive) { setProfile('notfound'); setChecking(false); } });
    return () => { alive = false; };
  }, [username, viewerId]);

  const userId = typeof profile === 'object' && profile !== null ? profile.id : undefined;
  const { data: friendStatus = 'none' } = useFriendshipStatus(viewerId, userId);
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriendship = useRemoveFriendship();
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedImages = new Map<number, string>() } = useOwnedCardImages(userId);
  const { data: ownedCardsDetailed = [] } = useAllOwnedCardsDetailed(userId);
  const { data: showcase = new Set<number>() } = useShowcase(userId);
  const { data: tcgIndex = new Map() } = useTcgIndex();
  const { data: sets = [] } = useTcgSets();
  const { data: rarities = [] } = useTcgRarities();
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: pinnedGoals = [] } = useSetGoals(userId);
  const setsById = useMemo(() => new Map(sets.map(s => [s.id, s])), [sets]);
  const [gallerySet, setGallerySet] = useState<FriendSetGalleryTarget | null>(null);
  // Grid taps zoom a single card; Vitrine taps zoom into the curated list and
  // support swiping to the next/previous showcased card without closing.
  // tradeCard is only set for cards this friend actually owns (the Statistiques
  // grid) — wishlist thumbnails also zoom via 'grid' but leave it undefined,
  // since you can't propose a trade for a card someone doesn't have yet.
  const [zoom, setZoom] = useState<
    { kind: 'grid'; card: ZoomableCard; tradeCard?: PickedCard } | { kind: 'vitrine'; index: number } | null
  >(null);
  const [tradeTarget, setTradeTarget] = useState<TradeTarget | null>(null);
  const [tradePreset, setTradePreset] = useState<PickedCard | undefined>(undefined);
  const [comparePromptOpen, setComparePromptOpen] = useState(false);
  const [compareInput, setCompareInput] = useState('');

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
  const [typeFilter, setType]     = useState<PokemonType[]>([]);
  const [setFilter, setSet]       = useState<string | null>(null);
  const [rarityFilter, setRarity] = useState<string | null>(null);
  const [generationFilter, setGeneration] = useState<number[]>([]);
  const [sort, setSort]           = useState<SortKey>('num-asc');
  const [columns, setColumns]     = useState<2 | 3 | 4 | null>(null);

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort,
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, generationFilter, sort],
  );

  const wishlistGroups = useMemo(() => {
    const sorted = [...(wishedCards as WishlistCard[])].sort((a, b) => a.dex_num - b.dex_num);
    return groupWishlistByPokemon(sorted, ownedCardIds);
  }, [wishedCards, ownedCardIds]);

  const { colors } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    banner: { padding: spacing.md, backgroundColor: colors.surface, ...shadow.sm, gap: spacing.sm },
    backRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, alignSelf: 'flex-start' as const },
    backText: { fontSize: 14, fontFamily: fonts.body, color: colors.primary },
    bannerTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
    bannerTitle: { fontSize: 20, fontFamily: fonts.display, color: colors.text, flex: 1 },
    friendBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    friendBtnSecondary: { backgroundColor: colors.surfaceAlt },
    friendBtnText: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white' },
    friendBtnTextSecondary: { color: colors.text },
    compareBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start' as const,
    },
    compareBtnText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
    compareSheetBody: { padding: spacing.md, gap: spacing.md },
    compareSheetHint: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    compareInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12,
      fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    compareSubmitBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: radius.md, alignItems: 'center' as const },
    compareSubmitText: { color: 'white', fontFamily: fonts.bodyBold },
    proposeTradeBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill,
      backgroundColor: '#2dd4bf',
    },
    proposeTradeBtnText: { fontSize: 13, fontFamily: fonts.bodyBold, color: 'white' },
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
    gridHeader: { padding: spacing.lg, gap: spacing.lg },
    section: { gap: spacing.sm },
    sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    sectionTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.text, flex: 1 },
    empty: { fontSize: 14, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, textAlign: 'center' as const, marginTop: spacing.xl },

    pokemonRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface,
      borderLeftWidth: 3, borderLeftColor: 'transparent',
    },
    pokemonRowOwned: { borderLeftColor: colors.success },
    pokemonMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, flex: 1 },
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
        <Text style={styles.notFoundTitle}>{t('profile.notFoundTitle')}</Text>
        <Pressable style={styles.cta} onPress={() => router.push('/signup')}>
          <Text style={styles.ctaText}>{t('profile.createCta')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ownedCount = items.filter(p => p.owned).length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.banner}>
        <Pressable onPress={goBack} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <View style={styles.bannerTitleRow}>
          <Text style={styles.bannerTitle}>{t('profile.heroTitle', { name: profile.display_name })}</Text>
          {viewerId && userId && viewerId !== userId && (
            friendStatus === 'friends' ? (
              <Pressable
                onPress={() => removeFriendship.mutate(userId)}
                style={[styles.friendBtn, styles.friendBtnSecondary]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.friendBtnText, styles.friendBtnTextSecondary]}>{t('profile.friendStatusFriends')}</Text>
              </Pressable>
            ) : friendStatus === 'pending_sent' ? (
              <Pressable
                onPress={() => removeFriendship.mutate(userId)}
                style={[styles.friendBtn, styles.friendBtnSecondary]}>
                <Text style={[styles.friendBtnText, styles.friendBtnTextSecondary]}>{t('profile.friendStatusPendingSent')}</Text>
              </Pressable>
            ) : friendStatus === 'pending_received' ? (
              <Pressable onPress={() => acceptRequest.mutate(userId)} style={styles.friendBtn}>
                <Ionicons name="person-add" size={14} color="white" />
                <Text style={styles.friendBtnText}>{t('profile.friendStatusAccept')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => sendRequest.mutate(userId)} style={styles.friendBtn}>
                <Ionicons name="person-add-outline" size={14} color="white" />
                <Text style={styles.friendBtnText}>{t('profile.friendStatusAdd')}</Text>
              </Pressable>
            )
          )}
        </View>
        <ProgressCounter owned={ownedCount} total={items.length} />
        <Pressable onPress={() => setComparePromptOpen(true)} style={styles.compareBtn}>
          <Ionicons name="git-compare-outline" size={14} color={colors.text} />
          <Text style={styles.compareBtnText}>{t('profile.compareButton')}</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(tb => (
          <Pressable key={tb.key} onPress={() => setTab(tb.key)} style={[styles.tabBtn, tab === tb.key && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === tb.key && styles.tabTextActive]}>{t(tb.labelKey)}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'stats' && (
        <>
          <PokedexGrid
            items={items}
            ownedImages={ownedImages}
            columnsOverride={columns}
            ListHeaderComponent={
              <View style={styles.gridHeader}>
                <VitrineCarousel items={vitrineItems} />
                <PokedexStatsSection userId={userId} showValueBadges={false} />
              </View>
            }
            onSelect={(num) => {
              // No detail page for visitors — a tap zooms the owned card directly instead.
              const card = ownedCardsByDex.get(num);
              if (card) setZoom({
                kind: 'grid', card: { image_small: card.imageSmall, image_large: card.imageLarge },
                tradeCard: { cardId: card.cardId, name: card.name, imageSmall: card.imageSmall, cardmarketTrendEur: card.cardmarketTrendEur },
              });
            }}
            onLongSelect={(num) => {
              const card = ownedCardsByDex.get(num);
              if (card) setZoom({
                kind: 'grid', card: { image_small: card.imageSmall, image_large: card.imageLarge },
                tradeCard: { cardId: card.cardId, name: card.name, imageSmall: card.imageSmall, cardmarketTrendEur: card.cardmarketTrendEur },
              });
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
            onReset={() => { setStatus('all'); setType([]); setSet(null); setRarity(null); setGeneration([]); }}
            columns={columns} onColumns={setColumns}
            bottomInset={spacing.lg}
          />
        </>
      )}

      {tab === 'collection' && (
        <ScrollView contentContainerStyle={styles.statsScroll}>
          <VitrineCarousel items={vitrineItems} />

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <IconBubble size={28} color={colors.primarySoft}>
                <Ionicons name="albums" size={15} color={colors.primary} />
              </IconBubble>
              <Text style={styles.sectionTitle}>{t('profile.pinnedSetsTitle')}</Text>
            </View>
            {pinnedGoals.length === 0 ? (
              <Text style={styles.empty}>{t('profile.noPinnedSets')}</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {pinnedGoals.map(g => {
                  const set = setsById.get(g.setId);
                  if (!set) return null;
                  return (
                    <SetGoalTile
                      key={g.setId}
                      userId={userId}
                      setId={g.setId}
                      setName={setFlagLabel(set.name, set.region, set.id)}
                      total={set.cardCount}
                      symbol={set.symbol}
                      onPress={() => {
                        // "Le format classique" — same numeric-aware card_number sort
                        // the pinned-set screen itself uses within an extension.
                        const setCards = ledgerCards
                          .filter(c => c.setId === g.setId)
                          .sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, undefined, { numeric: true }));
                        setGallerySet({
                          setName: setFlagLabel(set.name, set.region, set.id), owned: setCards.length, total: set.cardCount,
                          cards: setCards.map(c => ({ key: c.cardId, imageSmall: c.imageSmall, imageLarge: c.imageLarge })),
                        });
                      }}
                    />
                  );
                })}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      )}

      {tab === 'wishlist' && (
        <ScrollView contentContainerStyle={styles.wishlistScroll}>
          <VitrineCarousel items={vitrineItems} />
          {wishlistGroups.length === 0 ? (
            <Text style={styles.empty}>{t('profile.noWishlistCards')}</Text>
          ) : (
            wishlistGroups.map(group => {
              const mon = POKEDEX_BY_DEX.get(group.dexNum);
              const groupOwnedCount = group.cards.filter(c => ownedCardIds.has(c.id)).length;
              return (
                <View key={group.dexNum} style={[styles.pokemonRow, groupOwnedCount > 0 && styles.pokemonRowOwned]}>
                  <Pressable
                    style={styles.pokemonMain}
                    onPress={() => setGallerySet({
                      setName: mon ? getName(mon, locale) : `#${String(group.dexNum).padStart(4, '0')}`,
                      owned: groupOwnedCount,
                      total: group.cards.length,
                      cards: group.cards.map(c => ({ key: c.id, imageSmall: c.image_small, imageLarge: c.image_large })),
                    })}>
                    <View style={styles.pokemonSpriteWrap}>
                      {mon && <Image source={{ uri: mon.sprite_url }} style={styles.pokemonSprite} resizeMode="contain" />}
                      {groupOwnedCount > 0 && <View style={styles.pokemonOwnedBadge}><Pokeball size={13} /></View>}
                    </View>
                    <View style={styles.pokemonInfo}>
                      <Text style={styles.pokemonName} numberOfLines={1}>
                        #{String(group.dexNum).padStart(4, '0')} · {mon ? getName(mon, locale) : group.dexNum}
                      </Text>
                      <Text style={styles.pokemonSub}>
                        {t(group.cards.length > 1 ? 'wishlist.cardsInWishlistPlural' : 'wishlist.cardsInWishlistSingular', { n: group.cards.length })}
                        {groupOwnedCount > 0 ? t(groupOwnedCount > 1 ? 'wishlist.alreadyOwnedPlural' : 'wishlist.alreadyOwnedSingular', { n: groupOwnedCount }) : ''}
                      </Text>
                    </View>
                  </Pressable>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pokemonThumbs}>
                    {group.cards.slice(0, 4).map(c => (
                      <Pressable
                        key={c.id}
                        onPress={() => setZoom({ kind: 'grid', card: { image_small: c.image_small, image_large: c.image_large } })}
                        style={[styles.pokemonThumbWrap, ownedCardIds.has(c.id) && styles.pokemonThumbWrapOwned]}>
                        <Image source={{ uri: c.image_small }} style={styles.pokemonThumb} resizeMode="contain" />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      <FriendSetGalleryModal target={gallerySet} onClose={() => setGallerySet(null)} />
      <CardZoomModal
        card={activeZoomCard}
        onClose={() => setZoom(null)}
        onSwipeNext={zoom?.kind === 'vitrine' ? () => setZoom({ kind: 'vitrine', index: (zoom.index + 1) % vitrineCards.length }) : undefined}
        onSwipePrev={zoom?.kind === 'vitrine' ? () => setZoom({ kind: 'vitrine', index: (zoom.index - 1 + vitrineCards.length) % vitrineCards.length }) : undefined}
        footer={
          zoom?.kind === 'grid' && zoom.tradeCard && viewerId && userId && viewerId !== userId && friendStatus === 'friends' ? (
            <Pressable
              onPress={() => {
                const tradeCard = zoom.tradeCard;
                setZoom(null);
                setTradePreset(tradeCard);
                setTradeTarget({ id: userId, displayName: profile.display_name });
              }}
              style={styles.proposeTradeBtn}>
              <TradeIcon size={15} color="white" />
              <Text style={styles.proposeTradeBtnText}>{t('profile.proposeTradeButton')}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <TradeProposalModal
        target={tradeTarget}
        onClose={() => { setTradeTarget(null); setTradePreset(undefined); }}
        initialRequested={tradePreset}
      />
      <BubbleSheet
        visible={comparePromptOpen}
        onClose={() => setComparePromptOpen(false)}
        tint={colors.primary}
        title={t('profile.compareSheetTitle')}
        sizing="auto">
        <View style={styles.compareSheetBody}>
          <Text style={styles.compareSheetHint}>{t('profile.compareSheetHint', { name: profile.display_name })}</Text>
          <TextInput
            placeholder="username"
            placeholderTextColor={colors.textMuted}
            value={compareInput}
            onChangeText={setCompareInput}
            autoCapitalize="none"
            style={styles.compareInput}
          />
          <Pressable
            disabled={!compareInput.trim()}
            onPress={() => {
              const other = compareInput.trim().toLowerCase();
              setComparePromptOpen(false);
              setCompareInput('');
              router.push(`/compare/${profile.username}/${other}` as never);
            }}
            style={[styles.compareSubmitBtn, !compareInput.trim() && { opacity: 0.5 }]}>
            <Text style={styles.compareSubmitText}>{t('profile.compareSubmit')}</Text>
          </Pressable>
        </View>
      </BubbleSheet>
    </SafeAreaView>
  );
}
