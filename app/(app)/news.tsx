import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/auth';
import { useFriends, type FriendProfile } from '@/lib/friends';
import { useFriendNewsHistory, useReactToFriendNews, type FriendNewsItem } from '@/lib/friend-news';
import { useFriendLeaderboard } from '@/lib/leaderboard';
import { Avatar } from '@/components/Avatar';
import { NewsRow, NewsGroupRow, groupConsecutiveByAuthor } from '@/components/NewsRow';
import { NewsCommentSheet } from '@/components/NewsCommentSheet';
import { FriendCardReveal } from '@/components/FriendCardReveal';
import { EmptyState } from '@/components/EmptyState';
import { BackButton } from '@/components/BackButton';
import { CHASE_GOLD } from '@/lib/rarity-tiers';
import { useBackTo } from '@/lib/navigation';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { useT } from '@/lib/locale';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function NewsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors, heroGradient, heroText, heroTextMuted } = useTheme();
  const t = useT();

  const goBack = useBackTo('/friends');
  const { data: friends = [] } = useFriends(userId);
  const leaderboardIds = useMemo(
    () => userId ? [userId, ...friends.map(f => f.id)] : [],
    [userId, friends],
  );
  const { data: leaderboard = [] } = useFriendLeaderboard(leaderboardIds);
  const friendById = useMemo(() => new Map(friends.map(f => [f.id, f])), [friends]);

  const {
    data: historyPages, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useFriendNewsHistory(userId, true);
  const news = useMemo(() => historyPages?.pages.flatMap(p => p.items) ?? [], [historyPages]);
  const groups = useMemo(() => groupConsecutiveByAuthor(news), [news]);

  const react = useReactToFriendNews();
  const [reveal, setReveal] = useState<FriendNewsItem | null>(null);
  const [commentTarget, setCommentTarget] = useState<string | null>(null);

  const styles = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
    heroTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    heroTitle: { fontSize: 22, fontFamily: fonts.display, color: heroText },
    leaderboardSection: { paddingVertical: spacing.sm },
    leaderboardTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: heroTextMuted, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
    leaderboardRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
    leaderboardCard: {
      alignItems: 'center' as const, gap: 4, backgroundColor: colors.overlay, borderRadius: radius.md,
      padding: spacing.sm, width: 76,
    },
    medal: { fontSize: 16, position: 'absolute' as const, top: -6, right: -2 },
    leaderboardName: { fontSize: 11, fontFamily: fonts.bodyBold, color: heroText },
    leaderboardCount: { fontSize: 10, fontFamily: fonts.mono, color: heroTextMuted },
    activeDot: { position: 'absolute' as const, bottom: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    list: { padding: spacing.md, paddingBottom: spacing.md + TAB_BAR_CLEARANCE, gap: spacing.sm },
    center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: spacing.xl },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <BackButton onPress={goBack} color={heroText} />
          <Text style={styles.heroTitle}>{t('news.pageTitle')}</Text>
        </View>
        {leaderboard.length > 1 && (
          <View style={styles.leaderboardSection}>
            <Text style={styles.leaderboardTitle}>{t('news.leaderboardTitle')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaderboardRow}>
              {leaderboard.map((entry, i) => {
                const friend = friendById.get(entry.userId);
                const name = entry.userId === userId ? t('friends.isYou') : (friend?.displayName ?? '?');
                return (
                  <View key={entry.userId} style={styles.leaderboardCard}>
                    {i < 3 && <Text style={styles.medal}>{MEDALS[i]}</Text>}
                    <Avatar name={name} size={36} />
                    {entry.activeThisWeek && <View style={styles.activeDot} />}
                    <Text style={styles.leaderboardName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.leaderboardCount}>{t('news.leaderboardDexCount', { n: entry.dexCount })}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </LinearGradient>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon="sparkles-outline" hint={t('friends.newsEmpty')} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.items[0].id}
          contentContainerStyle={styles.list}
          renderItem={({ item: g }) =>
            g.items.length === 1 ? (
              <NewsRow
                item={g.items[0]}
                onOpenCard={setReveal}
                from="/news"
                onReact={(newsId, emoji) => react.mutate({ newsId, emoji })}
                onComment={item => setCommentTarget(item.id)}
              />
            ) : (
              <NewsGroupRow group={g} onOpen={setReveal} from="/news" />
            )
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginTop: spacing.sm }} /> : null}
        />
      )}

      <FriendCardReveal item={reveal} mode="history" onClose={() => setReveal(null)} />
      <NewsCommentSheet newsId={commentTarget} tint={CHASE_GOLD} onClose={() => setCommentTarget(null)} />
    </SafeAreaView>
  );
}
