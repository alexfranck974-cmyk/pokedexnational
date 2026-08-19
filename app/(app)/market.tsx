import { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/auth';
import { useFriends, type FriendProfile } from '@/lib/friends';
import { useOwnedCardQuantities } from '@/lib/collection';
import {
  usePendingTradeOffers, useInProgressTradeOffers, useFriendsAvailableCards, useFriendsWantedCards,
  type TradeOfferItem, type TradeInProgressItem, type FriendCardListing,
} from '@/lib/trades';
import { TradeProposalModal, type TradeTarget, type PickedCard } from '@/components/TradeProposalModal';
import { TradeOfferPopup } from '@/components/TradeOfferPopup';
import { TradeInProgressPopup } from '@/components/TradeInProgressPopup';
import { TradeIcon } from '@/components/TradeIcon';
import { Pokeball } from '@/components/Pokeball';
import { RefreshButton } from '@/components/RefreshButton';
import { IconBubble } from '@/components/IconBubble';
import { useBackTo } from '@/lib/navigation';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import { useT, useTRich } from '@/lib/locale';

const TRADE_TINT = '#2dd4bf';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.4, fontFamily: fonts.display, color: colors.primary }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// Standalone Marché screen — everything trade-related lives here now (moved out
// of friends.tsx, which stays focused on the social side: requests, friends
// list, news feed). Room to grow into a fuller marketplace experience later
// (highlighted mutual matches, a trade "counter" visual, trust history between
// friends) — this pass just gives it its own screen with the existing content.
export default function MarketScreen() {
  const goBack = useBackTo('/friends');
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors, heroGradient, heroText } = useTheme();
  const t = useT();
  const tRich = useTRich();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: friends = [], isLoading: friendsLoading } = useFriends(userId);
  const friendIdsArr = useMemo(() => friends.map((f: FriendProfile) => f.id), [friends]);
  const { data: availableCards = [] } = useFriendsAvailableCards(friendIdsArr);
  const { data: wantedCards = [] } = useFriendsWantedCards(friendIdsArr);
  const { data: myQuantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: tradeOffers = [] } = usePendingTradeOffers(userId);
  const { data: inProgressOffers = [] } = useInProgressTradeOffers(userId);
  const [openTrade, setOpenTrade] = useState<TradeOfferItem | null>(null);
  const [openInProgress, setOpenInProgress] = useState<TradeInProgressItem | null>(null);
  const [tradeTarget, setTradeTarget] = useState<TradeTarget | null>(null);
  const [tradePreset, setTradePreset] = useState<{ offered?: PickedCard; requested?: PickedCard }>({});
  const [friendSearch, setFriendSearch] = useState('');
  const [pickingFriend, setPickingFriend] = useState(false);

  const closeTradeModal = () => { setTradeTarget(null); setTradePreset({}); };
  const openTradeWith = (friendId: string, friendName: string, preset: { offered?: PickedCard; requested?: PickedCard } = {}) => {
    setTradePreset(preset);
    setTradeTarget({ id: friendId, displayName: friendName });
  };

  // A "start a free trade" entry point, not gated behind an existing
  // duplicate/wishlist match — opens TradeProposalModal with no card preset,
  // so the offer/request steps (search, set filters, wishlist matches surfaced
  // first) do all the work of picking what to give and what to ask for.
  const friendSearchN = normalize(friendSearch.trim());
  const filteredFriends = useMemo(
    () => friendSearchN ? friends.filter((f: FriendProfile) => normalize(f.displayName).includes(friendSearchN)) : friends,
    [friends, friendSearchN],
  );

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: spacing.md, gap: spacing.sm, ...shadow.sm,
    },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: heroText, fontSize: 14, fontFamily: fonts.body },
    heroTitle: { fontSize: 20, fontFamily: fonts.display, color: heroText },
    body: { padding: spacing.md, paddingBottom: spacing.md + TAB_BAR_CLEARANCE, gap: spacing.lg },
    sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    sectionTitle: { fontSize: 15, fontFamily: fonts.display, color: colors.text },
    sectionCount: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    rowInfo: { flex: 1, gap: 1 },
    list: { gap: spacing.sm },
    newsThumb: { width: 28, height: 28 / 0.72, borderRadius: 3 },
    newsText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    newsTextBold: { fontFamily: fonts.bodyBold },
    marketHint: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim },
    marketEmpty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, padding: spacing.sm },
    marketNoteText: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
    freeTradeBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.xs,
      backgroundColor: TRADE_TINT, borderRadius: radius.md, padding: spacing.sm,
    },
    freeTradeBtnText: { fontFamily: fonts.bodyBold, color: 'white', fontSize: 14 },
    searchInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10,
      fontSize: 14, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
  }));

  if (friendsLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}><ActivityIndicator /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Pressable onPress={goBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={heroText} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.heroTitle}>{t('market.title')}</Text>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={heroText} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        {...hideOnScrollProps}>
        <>
            <View style={styles.list}>
              {!pickingFriend ? (
                <Pressable onPress={() => setPickingFriend(true)} style={styles.freeTradeBtn}>
                  <TradeIcon size={15} color="white" />
                  <Text style={styles.freeTradeBtnText}>{t('market.startFreeTradeButton')}</Text>
                </Pressable>
              ) : (
                <>
                  <View style={styles.sectionTitleRow}>
                    <IconBubble size={26} color={colors.primarySoft}>
                      <TradeIcon size={13} color={TRADE_TINT} />
                    </IconBubble>
                    <Text style={styles.sectionTitle}>{t('market.chooseFriendTitle')}</Text>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => { setPickingFriend(false); setFriendSearch(''); }} hitSlop={8}>
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <TextInput
                    placeholder={t('market.searchFriendPlaceholder')}
                    value={friendSearch}
                    onChangeText={setFriendSearch}
                    style={styles.searchInput}
                  />
                  {filteredFriends.length === 0 ? (
                    <Text style={styles.marketEmpty}>
                      {friends.length === 0 ? t('market.noFriendsForTrading') : t('market.noFriendMatchesSearch')}
                    </Text>
                  ) : (
                    filteredFriends.map((f: FriendProfile) => (
                      <Pressable
                        key={f.id}
                        onPress={() => { setPickingFriend(false); setFriendSearch(''); openTradeWith(f.id, f.displayName); }}
                        style={styles.row}>
                        <Avatar name={f.displayName} />
                        <Text style={styles.newsText}>{f.displayName}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </Pressable>
                    ))
                  )}
                </>
              )}
            </View>

            {tradeOffers.length > 0 && (
              <View style={styles.list}>
                <View style={styles.sectionTitleRow}>
                  <IconBubble size={26} color={colors.primarySoft}>
                    <TradeIcon size={13} color={TRADE_TINT} />
                  </IconBubble>
                  <Text style={styles.sectionTitle}>{t('market.tradesTitle')}</Text>
                  <Text style={styles.sectionCount}>{tradeOffers.length}</Text>
                </View>
                {tradeOffers.map((to: TradeOfferItem) => (
                  <Pressable key={to.id} onPress={() => setOpenTrade(to)} style={styles.row}>
                    <Avatar name={to.counterpartyName} />
                    <Text style={styles.newsText}>
                      {to.direction === 'incoming'
                        ? tRich('trade.friendProposes', { name: to.counterpartyName }, styles.newsTextBold)
                        : tRich('market.waitingRow', { name: to.counterpartyName }, styles.newsTextBold)}
                    </Text>
                    <Image
                      source={{ uri: to.direction === 'incoming' ? to.offeredCard.imageSmall : to.requestedCard.imageSmall }}
                      style={styles.newsThumb} resizeMode="contain"
                    />
                  </Pressable>
                ))}
              </View>
            )}

            {inProgressOffers.length > 0 && (
              <View style={styles.list}>
                <View style={styles.sectionTitleRow}>
                  <IconBubble size={26} color={colors.primarySoft}>
                    <Pokeball size={15} />
                  </IconBubble>
                  <Text style={styles.sectionTitle}>{t('market.inProgressTitle')}</Text>
                  <Text style={styles.sectionCount}>{inProgressOffers.length}</Text>
                </View>
                <Text style={styles.marketHint}>{t('market.inProgressHint')}</Text>
                {inProgressOffers.map((ip: TradeInProgressItem) => (
                  <Pressable key={ip.id} onPress={() => setOpenInProgress(ip)} style={styles.row}>
                    <Avatar name={ip.counterpartyName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.newsText}>
                        {tRich('trade.exchangeWithName', { name: ip.counterpartyName }, styles.newsTextBold)}
                      </Text>
                      <Text style={styles.marketNoteText}>
                        {ip.myConfirmed ? t('tradeOffer.outgoingTitle', { name: ip.counterpartyName }) : t('market.waitingOnYourSide')}
                      </Text>
                    </View>
                    <Image
                      source={{ uri: ip.direction === 'incoming' ? ip.offeredCard.imageSmall : ip.requestedCard.imageSmall }}
                      style={styles.newsThumb} resizeMode="contain"
                    />
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.list}>
              <View style={styles.sectionTitleRow}>
                <IconBubble size={26} color={colors.primarySoft}>
                  <TradeIcon size={13} color={TRADE_TINT} />
                </IconBubble>
                <Text style={styles.sectionTitle}>{t('market.availableTitle')}</Text>
                <Text style={styles.sectionCount}>{availableCards.length}</Text>
              </View>
              <Text style={styles.marketHint}>{t('market.availableHint')}</Text>
              {availableCards.length === 0 ? (
                <Text style={styles.marketEmpty}>{t('market.noAvailableCards')}</Text>
              ) : (
                availableCards.map((a: FriendCardListing, i: number) => (
                  <Pressable
                    key={`${a.friendId}-${a.card.id}-${i}`}
                    onPress={() => openTradeWith(a.friendId, a.friendName, {
                      requested: { cardId: a.card.id, name: a.card.name, imageSmall: a.card.imageSmall, cardmarketTrendEur: a.card.cardmarketTrendEur },
                    })}
                    style={styles.row}>
                    <Avatar name={a.friendName} />
                    <Text style={styles.newsText}>
                      {tRich('market.friendHasDuplicate', { name: a.friendName, cardName: a.card.name }, styles.newsTextBold)}
                    </Text>
                    <Image source={{ uri: a.card.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.list}>
              <View style={styles.sectionTitleRow}>
                <IconBubble size={26} color={colors.primarySoft}>
                  <Ionicons name="heart-outline" size={13} color={colors.primary} />
                </IconBubble>
                <Text style={styles.sectionTitle}>{t('market.wantedTitle')}</Text>
                <Text style={styles.sectionCount}>{wantedCards.length}</Text>
              </View>
              <Text style={styles.marketHint}>{t('market.wantedHint')}</Text>
              {wantedCards.length === 0 ? (
                <Text style={styles.marketEmpty}>{t('market.noWantedCards')}</Text>
              ) : (
                wantedCards.map((w: FriendCardListing, i: number) => {
                  // Manual proposals work from a single unique copy — only the
                  // automatic suggestion badge/popup (see countMarketMatches,
                  // _layout.tsx) stays duplicate-gated, so it doesn't nag about
                  // giving away your only copy of something.
                  const canFulfill = (myQuantities.get(w.card.id) ?? 0) >= 1;
                  const isDuplicate = (myQuantities.get(w.card.id) ?? 0) >= 2;
                  return (
                    <Pressable
                      key={`${w.friendId}-${w.card.id}-${i}`}
                      disabled={!canFulfill}
                      onPress={() => openTradeWith(w.friendId, w.friendName, {
                        offered: { cardId: w.card.id, name: w.card.name, imageSmall: w.card.imageSmall, cardmarketTrendEur: w.card.cardmarketTrendEur },
                      })}
                      style={[styles.row, !canFulfill && { opacity: 0.5 }]}>
                      <Avatar name={w.friendName} />
                      <View style={styles.rowInfo}>
                        <Text style={styles.newsText}>
                          {tRich('market.friendWantsCard', { name: w.friendName, cardName: w.card.name }, styles.newsTextBold)}
                        </Text>
                        {!canFulfill && <Text style={styles.marketNoteText}>{t('market.dontOwnCard')}</Text>}
                        {canFulfill && !isDuplicate && <Text style={styles.marketNoteText}>{t('market.onlyCopyWarning')}</Text>}
                      </View>
                      <Image source={{ uri: w.card.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
                    </Pressable>
                  );
                })
              )}
            </View>
        </>
      </ScrollView>

      <TradeProposalModal
        target={tradeTarget}
        onClose={closeTradeModal}
        initialOffered={tradePreset.offered}
        initialRequested={tradePreset.requested}
      />
      <TradeOfferPopup item={openTrade} onClose={() => setOpenTrade(null)} />
      <TradeInProgressPopup item={openInProgress} onClose={() => setOpenInProgress(null)} />
    </SafeAreaView>
  );
}
