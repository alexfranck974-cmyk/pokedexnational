import { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, RefreshControl } from 'react-native';
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

const TRADE_TINT = '#2dd4bf';

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
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: friends = [] } = useFriends(userId);
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

  const closeTradeModal = () => { setTradeTarget(null); setTradePreset({}); };
  const openTradeWith = (friendId: string, friendName: string, preset: { offered?: PickedCard; requested?: PickedCard } = {}) => {
    setTradePreset(preset);
    setTradeTarget({ id: friendId, displayName: friendName });
  };

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: spacing.md, gap: spacing.sm, ...shadow.sm,
    },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: 'white', fontSize: 14, fontFamily: fonts.body },
    heroTitle: { fontSize: 20, fontFamily: fonts.display, color: 'white' },
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
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Pressable onPress={goBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color="white" />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.heroTitle}>Marché</Text>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        {...hideOnScrollProps}>
        <>
            {tradeOffers.length > 0 && (
              <View style={styles.list}>
                <View style={styles.sectionTitleRow}>
                  <IconBubble size={26} color={colors.primarySoft}>
                    <TradeIcon size={13} color={TRADE_TINT} />
                  </IconBubble>
                  <Text style={styles.sectionTitle}>Échanges</Text>
                  <Text style={styles.sectionCount}>{tradeOffers.length}</Text>
                </View>
                {tradeOffers.map((t: TradeOfferItem) => (
                  <Pressable key={t.id} onPress={() => setOpenTrade(t)} style={styles.row}>
                    <Avatar name={t.counterpartyName} />
                    <Text style={styles.newsText}>
                      {t.direction === 'incoming' ? (
                        <><Text style={styles.newsTextBold}>{t.counterpartyName}</Text> te propose un échange</>
                      ) : (
                        <>En attente de <Text style={styles.newsTextBold}>{t.counterpartyName}</Text></>
                      )}
                    </Text>
                    <Image
                      source={{ uri: t.direction === 'incoming' ? t.offeredCard.imageSmall : t.requestedCard.imageSmall }}
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
                  <Text style={styles.sectionTitle}>Échanges en cours</Text>
                  <Text style={styles.sectionCount}>{inProgressOffers.length}</Text>
                </View>
                <Text style={styles.marketHint}>Échangez les cartes en vrai, puis confirmez ici tous les deux.</Text>
                {inProgressOffers.map((t: TradeInProgressItem) => (
                  <Pressable key={t.id} onPress={() => setOpenInProgress(t)} style={styles.row}>
                    <Avatar name={t.counterpartyName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.newsText}>
                        Échange avec <Text style={styles.newsTextBold}>{t.counterpartyName}</Text>
                      </Text>
                      <Text style={styles.marketNoteText}>
                        {t.myConfirmed ? `En attente de ${t.counterpartyName}` : 'À confirmer de ton côté'}
                      </Text>
                    </View>
                    <Image
                      source={{ uri: t.direction === 'incoming' ? t.offeredCard.imageSmall : t.requestedCard.imageSmall }}
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
                <Text style={styles.sectionTitle}>Disponible chez tes amis</Text>
                <Text style={styles.sectionCount}>{availableCards.length}</Text>
              </View>
              <Text style={styles.marketHint}>Doublons de tes amis — propose un échange pour en récupérer un.</Text>
              {availableCards.length === 0 ? (
                <Text style={styles.marketEmpty}>Aucun doublon disponible chez tes amis pour l’instant.</Text>
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
                      <Text style={styles.newsTextBold}>{a.friendName}</Text> a {a.card.name} en double
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
                <Text style={styles.sectionTitle}>Recherché par tes amis</Text>
                <Text style={styles.sectionCount}>{wantedCards.length}</Text>
              </View>
              <Text style={styles.marketHint}>Cartes dans la wishlist de tes amis — propose un échange, doublon ou pas.</Text>
              {wantedCards.length === 0 ? (
                <Text style={styles.marketEmpty}>Tes amis n’ont rien en wishlist pour l’instant.</Text>
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
                          <Text style={styles.newsTextBold}>{w.friendName}</Text> recherche {w.card.name}
                        </Text>
                        {!canFulfill && <Text style={styles.marketNoteText}>Tu ne possèdes pas cette carte</Text>}
                        {canFulfill && !isDuplicate && <Text style={styles.marketNoteText}>Ta seule copie — tu ne l’auras plus après l’échange</Text>}
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
