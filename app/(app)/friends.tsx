import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
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
import { useFriendNewsFeed, type FriendNewsItem } from '@/lib/friend-news';
import { FriendCardReveal } from '@/components/FriendCardReveal';
import { Avatar } from '@/components/Avatar';
import { NewsGroupRow, groupConsecutiveByAuthor } from '@/components/NewsRow';
import { RefreshButton } from '@/components/RefreshButton';
import { ConfirmDialog, type ConfirmTarget } from '@/components/ConfirmDialog';
import { IconBubble } from '@/components/IconBubble';
import { QRCodeModal } from '@/components/QRCodeModal';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';
import { toast } from '@/lib/toast';
import { withReturnTo } from '@/lib/navigation';
import { useT } from '@/lib/locale';

export default function FriendsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const t = useT();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: friends = [], isLoading: friendsLoading } = useFriends(userId);
  const { data: incoming = [] } = useIncomingRequests(userId);
  const { data: outgoing = [] } = useOutgoingRequests(userId);
  const { data: friendNews = [] } = useFriendNewsFeed(userId);
  const [openNews, setOpenNews] = useState<FriendNewsItem | null>(null);
  // Compact preview only — the latest 2 items (feed is oldest-first, so the
  // most recent are at the end), grouped the same way the full /news page
  // groups them. Full browsing (filters, pagination, reactions, comments,
  // leaderboard) lives on /news now.
  const previewGroups = useMemo(
    () => groupConsecutiveByAuthor([...(friendNews as FriendNewsItem[])].reverse().slice(0, 2)),
    [friendNews],
  );

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
    (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('username').eq('id', userId).single();
        if (data) setMyUsername(data.username);
        else if (error) toast(t('common.loadError'));
      } catch {
        toast(t('common.loadError'));
      }
    })();
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
    seeAllBtn: { alignItems: 'center' as const, padding: spacing.sm },
    seeAllText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.primary },
  }));

  const alreadyRelated = found && (friendIds.has(found.id) || outgoingIds.has(found.id) || found.id === userId);

  const confirmTarget: ConfirmTarget | null = unfriendTarget
    ? { title: t('friends.unfriendTitle'), message: t('friends.unfriendMessage', { name: unfriendTarget.name }) }
    : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('friends.title')}</Text>
          <View style={styles.headerActions}>
            <RefreshButton refreshing={refreshing} onRefresh={onRefresh} color={colors.primary} />
            <Pressable onPress={() => setQrOpen(true)} style={styles.qrBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('friends.a11yShareQr')}>
              <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <TextInput
          placeholder={t('friends.searchPlaceholder')}
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
                  {found.id === userId ? t('friends.isYou') : friendIds.has(found.id) ? t('friends.alreadyFriend') : t('profile.friendStatusPendingSent')}
                </Text>
              ) : (
                <Pressable onPress={() => sendRequest.mutate(found.id)} style={styles.actionBtn}>
                  <Ionicons name="person-add-outline" size={14} color="white" />
                  <Text style={styles.actionBtnText}>{t('profile.friendStatusAdd')}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.empty}>{t('friends.noAccountFound')}</Text>
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
                  <Text style={styles.sectionTitle}>{t('friends.incomingRequests')}</Text>
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
                      <Text style={styles.actionBtnText}>{t('profile.friendStatusAccept')}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeFriendship.mutate(r.id)} style={styles.secondaryBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('friends.a11yRejectRequest')}>
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
                  <Text style={styles.sectionTitle}>{t('friends.outgoingRequests')}</Text>
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
                      <Text style={styles.rowUsername}>{t('common.cancel')}</Text>
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
                <Text style={styles.sectionTitle}>{t('friends.myFriends')}</Text>
                <Text style={styles.sectionCount}>{friends.length}</Text>
              </View>
              {friendsLoading ? (
                <ActivityIndicator />
              ) : friends.length === 0 ? (
                <Text style={styles.empty}>{t('friends.noFriendsYet')}</Text>
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
                      style={styles.secondaryBtn} hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('friends.a11yUnfriend')}>
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
                <Text style={styles.sectionTitle}>{t('friends.newsTitle')}</Text>
                {friendNews.length > 0 && <Text style={styles.sectionCount}>{friendNews.length}</Text>}
              </View>
              {friendNews.length === 0 ? (
                <Text style={styles.empty}>{t('friends.newsEmpty')}</Text>
              ) : (
                previewGroups.map(g => (
                  <NewsGroupRow key={g.items[0].id} group={g} onOpen={setOpenNews} from="/friends" />
                ))
              )}
              <Pressable onPress={() => router.push('/news')} style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>{t('friends.newsSeeAll')}</Text>
              </Pressable>
            </View>
        </>
      </ScrollView>

      <ConfirmDialog
        target={confirmTarget}
        onConfirm={() => { if (unfriendTarget) removeFriendship.mutate(unfriendTarget.id); setUnfriendTarget(null); }}
        onCancel={() => setUnfriendTarget(null)}
      />
      <QRCodeModal visible={qrOpen} value={myShareUrl} label={t('friends.myQrCode')} onClose={() => setQrOpen(false)} />
      <FriendCardReveal item={openNews} mode="live" onClose={() => setOpenNews(null)} />
    </SafeAreaView>
  );
}
