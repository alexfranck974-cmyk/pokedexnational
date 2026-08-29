import { useEffect, useRef, useState } from 'react';
import { Redirect, Tabs, useRouter, usePathname } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useIncomingRequests, useFriends } from '@/lib/friends';
import { useFriendNewsFeed } from '@/lib/friend-news';
import { usePendingTradeOffers, useInProgressTradeOffers, useFriendsAvailableCards, useFriendsWantedCards, countMarketMatches } from '@/lib/trades';
import { useAllWishedCards, useOwnedCardQuantities } from '@/lib/collection';
import { useSocialRealtime } from '@/lib/realtime';
import { Animated, Easing, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PokedexDeviceIcon } from '@/components/PokedexDeviceIcon';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { TradeIcon } from '@/components/TradeIcon';
import { TradeInProgressPopup } from '@/components/TradeInProgressPopup';
import { Pokeball } from '@/components/Pokeball';
import { NotificationBanner } from '@/components/NotificationBanner';
import { useAppNotifications } from '@/lib/notifications';
import { TabBarVisibilityProvider, useTabBarVisibility } from '@/lib/tab-bar-visibility';
import { withAlpha } from '@/lib/color-utils';
import { withReturnTo } from '@/lib/navigation';
import { useTheme, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

const BAR_SIDE_INSET = spacing.lg;
const BAR_BOTTOM_OFFSET = spacing.lg;
const BAR_HEIGHT = 62;

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <TabBarVisibilityProvider>
      <AppLayoutTabs />
    </TabBarVisibilityProvider>
  );
}

function AppLayoutTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { colors } = useTheme();
  const t = useT();
  const { translateY } = useTabBarVisibility();
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
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // SlideTransition (inside pokedex/favorites/wishlist) already
          // handles the cross-tab transition — the navigator's own built-in
          // fade was stacking on top of it, two opacity animations with
          // different timings, which is what actually read as a flash.
          animation: 'none',
        }}
      >
        {/*
          Dashboard listed first (its Tabs.Screen order = the navigator's implicit
          initial route, no explicit initialRouteName is set). Tab-to-tab
          navigation collapses via history.replaceState rather than pushing new
          entries, so the mobile back gesture always bottoms out on whichever tab
          is initial — putting Dashboard first makes that Dashboard, notably for
          the pokemon/[num] hidden route reached from Pokédex/Wishlist/Favoris.
        */}
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
            ),
          }}
        />
        {/*
          "Pokédex" now stands for the whole card-management group — the tab
          itself lands on the National Pokédex, and PokedexSectionTabs (rendered
          inside pokedex.tsx/wishlist.tsx/favorites.tsx) switches between it,
          Collection (favorites route) and Wishlist via real navigation, not a
          nested tab bar — see the restructuring plan for why.
        */}
        <Tabs.Screen
          name="pokedex"
          options={{
            title: 'Pokédex',
            tabBarIcon: ({ focused, size }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
                <PokedexDeviceIcon size={size - 2} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Social',
            tabBarIcon: ({ focused, color, size }) => (
              <View>
                <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
                {(incomingRequests.length > 0 || friendNews.length > 0 || incomingTrades.length > 0) && <View style={[styles.requestDot, { borderColor: colors.surface }]} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen name="wishlist" options={{ href: null }} />
        <Tabs.Screen name="favorites" options={{ href: null }} />
        <Tabs.Screen name="market" options={{ href: null }} />
        <Tabs.Screen name="news" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="feedback" options={{ href: null }} />
        <Tabs.Screen name="pokemon/[num]" options={{ href: null }} />
        <Tabs.Screen name="pinned-set/[setId]" options={{ href: null }} />
        <Tabs.Screen name="binder/[binderId]" options={{ href: null }} />
        <Tabs.Screen name="artist/[artist]" options={{ href: null }} />
      </Tabs>
      <Animated.View style={[styles.settingsFabWrap, { transform: [{ translateY }] }]}>
        <Pressable
          onPress={() => router.push('/settings')}
          style={[styles.settingsFab, { backgroundColor: withAlpha(colors.surface, 0.86), borderColor: withAlpha(colors.border, 0.6) }]}
          accessibilityRole="button"
          accessibilityLabel={t('appLayout.a11ySettings')}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.tradeFabWrap, { transform: [{ translateY }] }]}>
        <Pressable
          onPress={() => router.push(withReturnTo('/market', pathname) as never)}
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
        <Animated.View style={[styles.inProgressFabWrap, { transform: [{ translateY }] }]}>
          <Pressable
            onPress={() => setOpenInProgress(inProgressOffers[0])}
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
      <TradeInProgressPopup item={openInProgress} onClose={() => setOpenInProgress(null)} />
      <NotificationBanner event={notification} onDone={dismissNotification} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapFocused: { transform: [{ scale: 1.1 }] },
  requestDot: {
    position: 'absolute', top: -1, right: -3, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#ef4444', borderWidth: 1.5,
  },
  settingsFabWrap: {
    position: 'absolute', right: BAR_SIDE_INSET, bottom: BAR_BOTTOM_OFFSET + BAR_HEIGHT + spacing.sm,
  },
  tradeFabWrap: {
    position: 'absolute', left: BAR_SIDE_INSET, bottom: BAR_BOTTOM_OFFSET + BAR_HEIGHT + spacing.sm,
  },
  inProgressFabWrap: {
    position: 'absolute', left: BAR_SIDE_INSET, bottom: BAR_BOTTOM_OFFSET + BAR_HEIGHT + spacing.sm + 44 + spacing.sm,
  },
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
