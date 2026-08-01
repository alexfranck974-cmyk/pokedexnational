import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Image, Pressable, FlatList, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  useFriends, useIncomingRequests, useOutgoingRequests, useFindProfileByUsername,
  useSendFriendRequest, useAcceptFriendRequest, useRemoveFriendship,
  type FriendProfile, type FriendRequest,
} from '@/lib/friends';
import { useOwnedCardQuantities } from '@/lib/collection';
import { useFriendNewsFeed, useFriendNewsHistory, type FriendNewsItem } from '@/lib/friend-news';
import { FriendCardReveal } from '@/components/FriendCardReveal';
import { BubbleSheet } from '@/components/BubbleSheet';
import { CHASE_GOLD } from '@/lib/rarity-tiers';
import {
  usePendingTradeOffers, useFriendsAvailableCards, useFriendsWantedCards,
  type TradeOfferItem, type FriendCardListing,
} from '@/lib/trades';
import { TradeProposalModal, type TradeTarget, type PickedCard } from '@/components/TradeProposalModal';
import { TradeOfferPopup } from '@/components/TradeOfferPopup';
import { TradeIcon } from '@/components/TradeIcon';
import { RefreshButton } from '@/components/RefreshButton';
import { ConfirmDialog, type ConfirmTarget } from '@/components/ConfirmDialog';
import { IconBubble } from '@/components/IconBubble';
import { QRCodeModal } from '@/components/QRCodeModal';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';

const TRADE_TINT = '#2dd4bf';

const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const chipStyles = useThemedStyles((colors) => ({
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    active: { backgroundColor: colors.primary },
    text: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    textActive: { color: 'white' },
  }));
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.active]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
    </Pressable>
  );
};

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

export default function FriendsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: friends = [], isLoading: friendsLoading } = useFriends(userId);
  const { data: incoming = [] } = useIncomingRequests(userId);
  const { data: outgoing = [] } = useOutgoingRequests(userId);
  const { data: friendNews = [] } = useFriendNewsFeed(userId);
  const [openNews, setOpenNews] = useState<FriendNewsItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReveal, setHistoryReveal] = useState<FriendNewsItem | null>(null);
  const { data: newsHistory = [] } = useFriendNewsHistory(userId, historyOpen);
  const { data: tradeOffers = [] } = usePendingTradeOffers(userId);
  const [openTrade, setOpenTrade] = useState<TradeOfferItem | null>(null);
  const [tradeTarget, setTradeTarget] = useState<TradeTarget | null>(null);
  const [tradePreset, setTradePreset] = useState<{ offered?: PickedCard; requested?: PickedCard }>({});
  const [subTab, setSubTab] = useState<'friends' | 'market'>('friends');

  const friendIdsArr = useMemo(() => friends.map(f => f.id), [friends]);
  const { data: availableCards = [] } = useFriendsAvailableCards(friendIdsArr);
  const { data: wantedCards = [] } = useFriendsWantedCards(friendIdsArr);
  const { data: myQuantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const myDuplicateIds = useMemo(
    () => new Set([...myQuantities.entries()].filter(([, q]) => q >= 2).map(([id]) => id)),
    [myQuantities],
  );

  const closeTradeModal = () => { setTradeTarget(null); setTradePreset({}); };
  const openTradeWith = (friendId: string, friendName: string, preset: { offered?: PickedCard; requested?: PickedCard } = {}) => {
    setTradePreset(preset);
    setTradeTarget({ id: friendId, displayName: friendName });
  };

  const [search, setSearch] = useState('');
  const { data: found, isFetching: searching } = useFindProfileByUsername(search);

  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriendship = useRemoveFriendship();
  const [unfriendTarget, setUnfriendTarget] = useState<{ id: string; name: string } | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('username').eq('id', userId).single()
      .then(({ data }) => { if (data) setMyUsername(data.username); });
  }, [userId]);

  const myShareUrl = myUsername ? `${process.env.EXPO_PUBLIC_APP_URL ?? ''}/u/${myUsername}` : '';

  const friendIds = new Set(friends.map(f => f.id));
  const outgoingIds = new Set(outgoing.map(r => r.id));

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, gap: spacing.sm },
    titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    title: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
    qrBtn: { padding: 6 },
    headerActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
    searchInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12,
      fontSize: 15, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
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
    rowName: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    rowUsername: { fontSize: 12, fontFamily: fonts.mono, color: colors.textMuted },
    actionBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
      paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primary,
    },
    actionBtnText: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white' },
    secondaryBtn: { padding: 6 },
    list: { gap: spacing.sm },
    newsThumb: { width: 28, height: 28 / 0.72, borderRadius: 3 },
    newsText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    newsTextBold: { fontFamily: fonts.bodyBold },
    tradeBtn: { padding: 6 },
    chipRow: { flexDirection: 'row' as const, gap: spacing.sm },
    marketHint: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim },
    marketEmpty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, padding: spacing.sm },
    marketNoteText: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
  }));

  const alreadyRelated = found && (friendIds.has(found.id) || outgoingIds.has(found.id) || found.id === userId);

  const confirmTarget: ConfirmTarget | null = unfriendTarget
    ? { title: 'Retirer cet ami', message: `Retirer "${unfriendTarget.name}" de tes amis ?` }
    : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{subTab === 'friends' ? 'Amis' : 'Marché'}</Text>
          <View style={styles.headerActions}>
            <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
            <Pressable onPress={() => setQrOpen(true)} style={styles.qrBtn} hitSlop={8}>
              <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.chipRow}>
          <Chip label="Amis" active={subTab === 'friends'} onPress={() => setSubTab('friends')} />
          <Chip label="Marché" active={subTab === 'market'} onPress={() => setSubTab('market')} />
        </View>
        {subTab === 'friends' && (
        <TextInput
          placeholder="Chercher un pseudo pour ajouter un ami"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={styles.searchInput}
        />
        )}
        {subTab === 'friends' && search.trim().length >= 3 && (
          searching ? (
            <ActivityIndicator />
          ) : found ? (
            <View style={styles.row}>
              <Avatar name={found.displayName} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{found.displayName}</Text>
                <Text style={styles.rowUsername}>@{found.username}</Text>
              </View>
              {alreadyRelated ? (
                <Text style={styles.rowUsername}>
                  {found.id === userId ? 'C’est toi' : friendIds.has(found.id) ? 'Déjà ami' : 'Demande envoyée'}
                </Text>
              ) : (
                <Pressable onPress={() => sendRequest.mutate(found.id)} style={styles.actionBtn}>
                  <Ionicons name="person-add-outline" size={14} color="white" />
                  <Text style={styles.actionBtnText}>Ajouter</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.empty}>Aucun compte avec ce pseudo.</Text>
          )
        )}
      </View>

      <FlatList
        data={[1]}
        keyExtractor={() => 'body'}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        {...hideOnScrollProps}
        renderItem={() => (
          <>
          {subTab === 'friends' && (
          <>
            <View style={styles.list}>
              <View style={styles.sectionTitleRow}>
                <IconBubble size={26} color={colors.primarySoft}>
                  <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
                </IconBubble>
                <Text style={styles.sectionTitle}>Nouveautés</Text>
                {friendNews.length > 0 && <Text style={styles.sectionCount}>{friendNews.length}</Text>}
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => setHistoryOpen(true)} hitSlop={8}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              {friendNews.map((n: FriendNewsItem) => (
                <Pressable key={n.id} onPress={() => setOpenNews(n)} style={styles.row}>
                  <Avatar name={n.authorName} />
                  <Text style={styles.newsText}>
                    <Text style={styles.newsTextBold}>{n.authorName}</Text> a obtenu une carte {n.rarityLabel}
                  </Text>
                  <Image source={{ uri: n.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
                </Pressable>
              ))}
            </View>

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

            {incoming.length > 0 && (
              <View style={styles.list}>
                <View style={styles.sectionTitleRow}>
                  <IconBubble size={26} color={colors.primarySoft}>
                    <Ionicons name="mail-unread-outline" size={13} color={colors.primary} />
                  </IconBubble>
                  <Text style={styles.sectionTitle}>Demandes reçues</Text>
                  <Text style={styles.sectionCount}>{incoming.length}</Text>
                </View>
                {incoming.map((r: FriendRequest) => (
                  <View key={r.id} style={styles.row}>
                    <Avatar name={r.displayName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{r.displayName}</Text>
                      <Text style={styles.rowUsername}>@{r.username}</Text>
                    </View>
                    <Pressable onPress={() => acceptRequest.mutate(r.id)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>Accepter</Text>
                    </Pressable>
                    <Pressable onPress={() => removeFriendship.mutate(r.id)} style={styles.secondaryBtn} hitSlop={8}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {outgoing.length > 0 && (
              <View style={styles.list}>
                <View style={styles.sectionTitleRow}>
                  <IconBubble size={26} color={colors.primarySoft}>
                    <Ionicons name="paper-plane-outline" size={13} color={colors.primary} />
                  </IconBubble>
                  <Text style={styles.sectionTitle}>Demandes envoyées</Text>
                  <Text style={styles.sectionCount}>{outgoing.length}</Text>
                </View>
                {outgoing.map((r: FriendRequest) => (
                  <View key={r.id} style={styles.row}>
                    <Avatar name={r.displayName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{r.displayName}</Text>
                      <Text style={styles.rowUsername}>@{r.username}</Text>
                    </View>
                    <Pressable onPress={() => removeFriendship.mutate(r.id)} style={styles.secondaryBtn} hitSlop={8}>
                      <Text style={styles.rowUsername}>Annuler</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.list}>
              <View style={styles.sectionTitleRow}>
                <IconBubble size={26} color={colors.primarySoft}>
                  <Ionicons name="people-outline" size={13} color={colors.primary} />
                </IconBubble>
                <Text style={styles.sectionTitle}>Mes amis</Text>
                <Text style={styles.sectionCount}>{friends.length}</Text>
              </View>
              {friendsLoading ? (
                <ActivityIndicator />
              ) : friends.length === 0 ? (
                <Text style={styles.empty}>Pas encore d’amis — cherche un pseudo ci-dessus pour envoyer une demande.</Text>
              ) : (
                friends.map((f: FriendProfile) => (
                  <Pressable key={f.id} onPress={() => router.push(`/u/${f.username}`)} style={styles.row}>
                    <Avatar name={f.displayName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{f.displayName}</Text>
                      <Text style={styles.rowUsername}>@{f.username}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); openTradeWith(f.id, f.displayName); }}
                      style={styles.tradeBtn} hitSlop={8}>
                      <TradeIcon size={18} color={TRADE_TINT} />
                    </Pressable>
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); setUnfriendTarget({ id: f.id, name: f.displayName }); }}
                      style={styles.secondaryBtn} hitSlop={8}>
                      <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </Pressable>
                ))
              )}
            </View>
          </>
          )}

          {subTab === 'market' && (
          <>
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
              <Text style={styles.marketHint}>Cartes dans la wishlist de tes amis — offre un de tes doublons.</Text>
              {wantedCards.length === 0 ? (
                <Text style={styles.marketEmpty}>Tes amis n’ont rien en wishlist pour l’instant.</Text>
              ) : (
                wantedCards.map((w: FriendCardListing, i: number) => {
                  const canFulfill = myDuplicateIds.has(w.card.id);
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
                        {!canFulfill && <Text style={styles.marketNoteText}>Tu n’as pas de doublon de cette carte</Text>}
                      </View>
                      <Image source={{ uri: w.card.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
          )}
          </>
        )}
      />

      <ConfirmDialog
        target={confirmTarget}
        onConfirm={() => { if (unfriendTarget) removeFriendship.mutate(unfriendTarget.id); setUnfriendTarget(null); }}
        onCancel={() => setUnfriendTarget(null)}
      />
      <QRCodeModal visible={qrOpen} value={myShareUrl} label="Mon QR code" onClose={() => setQrOpen(false)} />
      <FriendCardReveal item={openNews} mode="live" onClose={() => setOpenNews(null)} />
      <BubbleSheet visible={historyOpen} onClose={() => setHistoryOpen(false)} tint={CHASE_GOLD} title="Historique">
        <ScrollView contentContainerStyle={[styles.list, { padding: spacing.md }]}>
          {newsHistory.length === 0 ? (
            <Text style={styles.empty}>Aucune pêche notable pour l'instant.</Text>
          ) : (
            newsHistory.map((n: FriendNewsItem) => (
              <Pressable key={n.id} onPress={() => setHistoryReveal(n)} style={styles.row}>
                <Avatar name={n.authorName} />
                <Text style={styles.newsText}>
                  <Text style={styles.newsTextBold}>{n.authorName}</Text> a obtenu une carte {n.rarityLabel}
                </Text>
                <Image source={{ uri: n.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
              </Pressable>
            ))
          )}
        </ScrollView>
      </BubbleSheet>
      <FriendCardReveal item={historyReveal} mode="history" onClose={() => setHistoryReveal(null)} />
      <TradeProposalModal
        target={tradeTarget}
        onClose={closeTradeModal}
        initialOffered={tradePreset.offered}
        initialRequested={tradePreset.requested}
      />
      <TradeOfferPopup item={openTrade} onClose={() => setOpenTrade(null)} />
    </SafeAreaView>
  );
}
