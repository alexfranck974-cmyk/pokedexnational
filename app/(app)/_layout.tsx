import { useEffect, useRef, useState } from 'react';
import { Redirect, Stack, useRouter, usePathname } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useIncomingRequests, useFriends } from '@/lib/friends';
import { useFriendNewsFeed } from '@/lib/friend-news';
import { usePendingTradeOffers, useInProgressTradeOffers, useFriendsAvailableCards, useFriendsWantedCards, countMarketMatches } from '@/lib/trades';
import { useAllWishedCards, useOwnedCardQuantities } from '@/lib/collection';
import { useSocialRealtime } from '@/lib/realtime';
import { Animated, Easing, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { TradeIcon } from '@/components/TradeIcon';
import { TradeInProgressPopup } from '@/components/TradeInProgressPopup';
import { Pokeball } from '@/components/Pokeball';
import { NotificationBanner } from '@/components/NotificationBanner';
import { useAppNotifications } from '@/lib/notifications';
import { TabBarVisibilityProvider, useTabBarVisibility } from '@/lib/tab-bar-visibility';
import { GlobalSearchBubble } from '@/components/GlobalSearchBubble';
import { withAlpha } from '@/lib/color-utils';
import { withReturnTo } from '@/lib/navigation';
import { useTheme, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

const BAR_SIDE_INSET = spacing.lg;
const BAR_BOTTOM_OFFSET = spacing.lg;
const BAR_HEIGHT = 62;
const FAB_SIZE = 44;
const FAB_GAP = spacing.sm;

// Bottom-up offset for the Nth stacked FAB in a side column (0 = the one
// sitting right above the tab bar).
function fabSlot(n: number) {
  return BAR_BOTTOM_OFFSET + BAR_HEIGHT + FAB_GAP + n * (FAB_SIZE + FAB_GAP);
}

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <TabBarVisibilityProvider>
      <AppLayoutStack />
    </TabBarVisibilityProvider>
  );
}

// Everything below used to be rendered once inside a flat <Tabs> alongside 3
// visible tabs (dashboard/pokedex/friends) AND 10 hidden (href:null)
// Tabs.Screen siblings (wishlist, a Pokémon's detail, an extension page,
// ...). React Navigation's hide-on-blur/back-gesture semantics never
// reliably applied to those hidden siblings on web — 3 separate targeted
// workarounds were needed for the same root cause this session
// (PokedexSectionTabs' own useIsFocused+pointerEvents guard, the
// useIsFocused+display:none guards on pokedex/wishlist/favorites.tsx, and
// the whole lib/history-back-guard.ts + lib/useModalBackClose.ts saga).
//
// Restructured 2026-09-21: only the 3 real tabs live inside the inner
// (tabs) Tabs navigator now (app/(app)/(tabs)/_layout.tsx) — every other
// screen is a plain Stack.Screen pushed on top of it here, which is what
// Stack navigators are actually for (proper mount/unmount, native back-
// gesture, no collapsed-history tricks needed). The persistent chrome
// (tab bar, FABs, trade popup, notification banner) moved up to this outer
// level so it stays visible on all 13 screens, not just the 3 real tabs —
// FloatingTabBar itself is now driven by pathname instead of react-
// navigation's tabBar render-prop contract, since it no longer has a single
// enclosing Tabs navigator to read state from.
function AppLayoutStack() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { colors } = useTheme();
  const t = useT();
  const { translateY } = useTabBarVisibility();
  // Settings/market/trade-in-progress fold into one "more" bubble on every
  // screen — collapsed by default, tap to reveal, reset on navigation so it
  // never stays expanded across a tab switch. Used to be Pokédex-only (four
  // separate floating buttons felt fine everywhere else); generalized since
  // every other screen had the exact same clutter, just less visibly so.
  const [moreExpanded, setMoreExpanded] = useState(false);
  useEffect(() => { setMoreExpanded(false); }, [pathname]);
  const userId = session?.user.id;
  const { data: incomingRequests = [] } = useIncomingRequests(userId);
  const { data: friendNews = [] } = useFriendNewsFeed(userId);
  const { data: tradeOffers = [] } = usePendingTradeOffers(userId);
  const incomingTrades = tradeOffers.filter(t => t.direction === 'incoming');
  const { data: inProgressOffers = [] } = useInProgressTradeOffers(userId);
  const [openInProgress, setOpenInProgress] = useState<(typeof inProgressOffers)[number] | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (inProgressOffers.length === 0) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => { loop.stop(); spin.setValue(0); };
  }, [inProgressOffers.length, spin]);
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  useSocialRealtime(userId);
  const { current: notification, dismiss: dismissNotification } = useAppNotifications(userId);
  const hasSocialBadge = incomingRequests.length > 0 || friendNews.length > 0 || incomingTrades.length > 0;

  // Market-bubble badge: pending incoming offers + cross-friend duplicate/wishlist
  // matches (same one-directional-per-term logic as the Marché tab's own per-row
  // "canFulfill" check, see lib/trades.ts's countMarketMatches). React Query
  // dedupes these against friends.tsx's own calls by query key, so visiting
  // Social doesn't refetch — it just reads the already-warm cache.
  const { data: friends = [] } = useFriends(userId);
  const friendIds = friends.map(f => f.id);
  const { data: availableCards = [] } = useFriendsAvailableCards(friendIds);
  const { data: wantedCards = [] } = useFriendsWantedCards(friendIds);
  const { data: myWishedCards = [] } = useAllWishedCards(userId);
  const { data: myQuantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const myWishedIds = new Set(myWishedCards.map(c => c.id));
  const myDuplicateIds = new Set([...myQuantities.entries()].filter(([, q]) => q >= 2).map(([id]) => id));
  const marketBadgeCount = incomingTrades.length + countMarketMatches(availableCards, wantedCards, myWishedIds, myDuplicateIds);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
      <FloatingTabBar hasSocialBadge={hasSocialBadge} />
      {/* Right column: the search bubble is the only always-visible FAB on
          every screen now — everything else lives in the left column's
          "more" bubble. */}
      <Animated.View style={[fabWrap('right', 0), { transform: [{ translateY }] }]}>
        <GlobalSearchBubble />
      </Animated.View>

      {/* Left column: settings/market/trade-in-progress fold into one "more"
          bubble, collapsed by default, on every screen — used to be four
          separate floating buttons (search + settings + market + trade)
          fighting for attention outside the Pokédex tab, which was the one
          screen this got fixed on first. */}
      <Animated.View style={[fabWrap('left', 0), { transform: [{ translateY }] }]}>
        <Pressable
          onPress={() => setMoreExpanded(v => !v)}
          style={[styles.settingsFab, { backgroundColor: withAlpha(colors.surface, 0.86), borderColor: withAlpha(colors.border, 0.6) }]}
          accessibilityRole="button"
          accessibilityLabel={t('appLayout.a11yMoreActions')}>
          <Ionicons name={moreExpanded ? 'close' : 'ellipsis-horizontal'} size={22} color={colors.text} />
          {!moreExpanded && (marketBadgeCount + inProgressOffers.length) > 0 && (
            <View style={[styles.tradeBadge, { borderColor: colors.surface }]}>
              <Text style={styles.tradeBadgeText}>{marketBadgeCount + inProgressOffers.length > 9 ? '9+' : marketBadgeCount + inProgressOffers.length}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
      {moreExpanded && (
        <>
          <Animated.View style={[fabWrap('left', 1), { transform: [{ translateY }] }]}>
            <Pressable
              onPress={() => { setMoreExpanded(false); router.push('/settings'); }}
              style={[styles.settingsFab, { backgroundColor: withAlpha(colors.surface, 0.86), borderColor: withAlpha(colors.border, 0.6) }]}
              accessibilityRole="button"
              accessibilityLabel={t('appLayout.a11ySettings')}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </Pressable>
          </Animated.View>
          <Animated.View style={[fabWrap('left', 2), { transform: [{ translateY }] }]}>
            <Pressable
              onPress={() => { setMoreExpanded(false); router.push(withReturnTo('/market', pathname) as never); }}
              style={[styles.settingsFab, { backgroundColor: withAlpha(colors.surface, 0.86), borderColor: withAlpha(colors.border, 0.6) }]}
              accessibilityRole="button"
              accessibilityLabel={t('appLayout.a11yMarket')}>
              <TradeIcon size={20} color={colors.text} />
              {marketBadgeCount > 0 && (
                <View style={[styles.tradeBadge, { borderColor: colors.surface }]}>
                  <Text style={styles.tradeBadgeText}>{marketBadgeCount > 9 ? '9+' : marketBadgeCount}</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
          {inProgressOffers.length > 0 && (
            <Animated.View style={[fabWrap('left', 3), { transform: [{ translateY }] }]}>
              <Pressable
                onPress={() => { setMoreExpanded(false); setOpenInProgress(inProgressOffers[0]); }}
                style={[styles.settingsFab, { backgroundColor: withAlpha(colors.surface, 0.86), borderColor: withAlpha(colors.border, 0.6) }]}
                accessibilityRole="button"
                accessibilityLabel={t('appLayout.a11yInProgressTrade')}>
                <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
                  <Pokeball size={22} />
                </Animated.View>
                {inProgressOffers.length > 1 && (
                  <View style={[styles.tradeBadge, { borderColor: colors.surface }]}>
                    <Text style={styles.tradeBadgeText}>{inProgressOffers.length}</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          )}
        </>
      )}
      <TradeInProgressPopup item={openInProgress} onClose={() => setOpenInProgress(null)} />
      <NotificationBanner event={notification} onDone={dismissNotification} />
    </View>
  );
}

function fabWrap(side: 'left' | 'right', slot: number) {
  return {
    position: 'absolute' as const,
    [side]: BAR_SIDE_INSET,
    bottom: fabSlot(slot),
  };
}

const styles = StyleSheet.create({
  settingsFab: {
    width: 44, height: 44, borderRadius: radius.pill,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  tradeBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: '#ef4444', borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  tradeBadgeText: { fontSize: 10, fontFamily: fonts.bodyBold, color: 'white' },
});
