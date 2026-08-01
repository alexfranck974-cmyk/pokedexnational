import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Image, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
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
import { useFriendNewsFeed, useFriendNewsHistory, type FriendNewsItem } from '@/lib/friend-news';
import { FriendCardReveal } from '@/components/FriendCardReveal';
import { BubbleSheet } from '@/components/BubbleSheet';
import { CHASE_GOLD } from '@/lib/rarity-tiers';
import { BRAVO_EMOJI } from '@/lib/friend-news';
import { RefreshButton } from '@/components/RefreshButton';
import { ConfirmDialog, type ConfirmTarget } from '@/components/ConfirmDialog';
import { IconBubble } from '@/components/IconBubble';
import { QRCodeModal } from '@/components/QRCodeModal';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import { withReturnTo } from '@/lib/navigation';

interface NewsGroup { authorId: string; authorName: string; items: FriendNewsItem[]; }

// Consecutive same-author runs collapse into one row — a friend who lands
// several notable pulls in a row shouldn't push everyone else off-screen.
function groupConsecutiveByAuthor(items: FriendNewsItem[]): NewsGroup[] {
  const groups: NewsGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.authorId === item.authorId) last.items.push(item);
    else groups.push({ authorId: item.authorId, authorName: item.authorName, items: [item] });
  }
  return groups;
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
  // Quick per-friend filter for the Nouveautés feed — only worth showing once
  // there's actually more than one friend making noise in it.
  const newsAuthors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of friendNews as FriendNewsItem[]) if (!seen.has(n.authorId)) seen.set(n.authorId, n.authorName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [friendNews]);
  const [newsFilterId, setNewsFilterId] = useState<string | null>(null);
  useEffect(() => {
    if (newsFilterId && !newsAuthors.some(a => a.id === newsFilterId)) setNewsFilterId(null);
  }, [newsAuthors, newsFilterId]);
  const filteredNews = useMemo(
    () => newsFilterId ? (friendNews as FriendNewsItem[]).filter(n => n.authorId === newsFilterId) : friendNews,
    [friendNews, newsFilterId],
  );
  const newsGroups = useMemo(() => groupConsecutiveByAuthor(filteredNews as FriendNewsItem[]), [filteredNews]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReveal, setHistoryReveal] = useState<FriendNewsItem | null>(null);
  const { data: newsHistory = [] } = useFriendNewsHistory(userId, historyOpen);

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
    // Bigger than the other sections' 28px icon-thumb — Nouveautés is meant to
    // show off "les plus belles cartes obtenues," not just flag that news exists.
    newsThumb: { width: 56, height: 78, borderRadius: 4 },
    newsText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    newsTextBold: { fontFamily: fonts.bodyBold },
    newsRowInfo: { flex: 1, gap: 3 },
    reactionRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
    reactionEmoji: { fontSize: 12 },
    reactionCount: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted },
    filterChips: { flexDirection: 'row' as const, gap: spacing.xs },
    filterChip: {
      paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted },
    filterChipTextActive: { color: 'white' },
    newsGroupThumbs: { maxWidth: 130, flexGrow: 0 },
    newsGroupThumbWrap: { marginRight: 4 },
    newsGroupThumb: { width: 40, height: 40 / 0.72, borderRadius: 3 },
  }));

  const alreadyRelated = found && (friendIds.has(found.id) || outgoingIds.has(found.id) || found.id === userId);

  const confirmTarget: ConfirmTarget | null = unfriendTarget
    ? { title: 'Retirer cet ami', message: `Retirer "${unfriendTarget.name}" de tes amis ?` }
    : null;

  const NewsRow = ({ item, onPress }: { item: FriendNewsItem; onPress: () => void }) => (
    <Pressable onPress={onPress} style={styles.row}>
      <Avatar name={item.authorName} />
      <View style={styles.newsRowInfo}>
        <Text style={styles.newsText}>
          <Text style={styles.newsTextBold}>{item.authorName}</Text> a obtenu une carte {item.rarityLabel}
        </Text>
        {item.reactionCount > 0 && (
          <View style={styles.reactionRow}>
            <Text style={styles.reactionEmoji}>{BRAVO_EMOJI}</Text>
            <Text style={styles.reactionCount}>{item.reactionCount}</Text>
          </View>
        )}
      </View>
      <Image source={{ uri: item.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
    </Pressable>
  );

  const NewsGroupRow = ({ group, onOpen }: { group: NewsGroup; onOpen: (item: FriendNewsItem) => void }) => {
    if (group.items.length === 1) return <NewsRow item={group.items[0]} onPress={() => onOpen(group.items[0])} />;
    return (
      <View style={styles.row}>
        <Avatar name={group.authorName} />
        <View style={styles.newsRowInfo}>
          <Text style={styles.newsText}>
            <Text style={styles.newsTextBold}>{group.authorName}</Text> a obtenu {group.items.length} cartes remarquables
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.newsGroupThumbs}>
          {group.items.map(item => (
            <Pressable key={item.id} onPress={() => onOpen(item)} style={styles.newsGroupThumbWrap}>
              <Image source={{ uri: item.imageSmall }} style={styles.newsGroupThumb} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Amis</Text>
          <View style={styles.headerActions}>
            <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
            <Pressable onPress={() => setQrOpen(true)} style={styles.qrBtn} hitSlop={8}>
              <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <TextInput
          placeholder="Chercher un pseudo pour ajouter un ami"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {search.trim().length >= 3 && (
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

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        {...hideOnScrollProps}>
        <>
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
                  <Pressable key={f.id} onPress={() => router.push(withReturnTo(`/u/${f.username}`, '/friends') as never)} style={styles.row}>
                    <Avatar name={f.displayName} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{f.displayName}</Text>
                      <Text style={styles.rowUsername}>@{f.username}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); setUnfriendTarget({ id: f.id, name: f.displayName }); }}
                      style={styles.secondaryBtn} hitSlop={8}>
                      <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </Pressable>
                ))
              )}
            </View>

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
              {newsAuthors.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  <Pressable onPress={() => setNewsFilterId(null)} style={[styles.filterChip, newsFilterId === null && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, newsFilterId === null && styles.filterChipTextActive]}>Tous</Text>
                  </Pressable>
                  {newsAuthors.map(a => (
                    <Pressable
                      key={a.id}
                      onPress={() => setNewsFilterId(a.id)}
                      style={[styles.filterChip, newsFilterId === a.id && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, newsFilterId === a.id && styles.filterChipTextActive]}>{a.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {friendNews.length === 0 ? (
                <Text style={styles.empty}>Rien de notable chez tes amis pour l’instant.</Text>
              ) : newsGroups.length === 0 ? (
                <Text style={styles.empty}>Rien de notable de ce côté-là pour l’instant.</Text>
              ) : (
                newsGroups.map((g: NewsGroup) => (
                  <NewsGroupRow key={g.items[0].id} group={g} onOpen={setOpenNews} />
                ))
              )}
            </View>
        </>
      </ScrollView>

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
              <NewsRow key={n.id} item={n} onPress={() => setHistoryReveal(n)} />
            ))
          )}
        </ScrollView>
      </BubbleSheet>
      <FriendCardReveal item={historyReveal} mode="history" onClose={() => setHistoryReveal(null)} />
    </SafeAreaView>
  );
}
