import { Redirect, Tabs, useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useIncomingRequests } from '@/lib/friends';
import { useFriendNewsFeed } from '@/lib/friend-news';
import { usePendingTradeOffers } from '@/lib/trades';
import { useSocialRealtime } from '@/lib/realtime';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PokedexDeviceIcon } from '@/components/PokedexDeviceIcon';
import { withAlpha } from '@/lib/color-utils';
import { useTheme, radius, spacing } from '@/lib/theme';

const BAR_SIDE_INSET = spacing.lg;
const BAR_BOTTOM_OFFSET = spacing.lg;
const BAR_HEIGHT = 62;

export default function AppLayout() {
  const router = useRouter();
  const { session, loading } = useSession();
  const { colors } = useTheme();
  const { data: incomingRequests = [] } = useIncomingRequests(session?.user.id);
  const { data: friendNews = [] } = useFriendNewsFeed(session?.user.id);
  const { data: tradeOffers = [] } = usePendingTradeOffers(session?.user.id);
  const incomingTrades = tradeOffers.filter(t => t.direction === 'incoming');
  useSocialRealtime(session?.user.id);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarStyle: {
            position: 'absolute',
            left: BAR_SIDE_INSET,
            right: BAR_SIDE_INSET,
            bottom: BAR_BOTTOM_OFFSET,
            height: BAR_HEIGHT,
            borderRadius: radius.xl,
            backgroundColor: withAlpha(colors.surface, 0.86),
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, 0.6),
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
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
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="pokemon/[num]" options={{ href: null }} />
        <Tabs.Screen name="pinned-set/[setId]" options={{ href: null }} />
      </Tabs>
      <Pressable
        onPress={() => router.push('/settings')}
        style={[styles.settingsFab, { backgroundColor: withAlpha(colors.surface, 0.86), borderColor: withAlpha(colors.border, 0.6) }]}>
        <Ionicons name="settings-outline" size={22} color={colors.text} />
      </Pressable>
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
  settingsFab: {
    position: 'absolute', right: BAR_SIDE_INSET, bottom: BAR_BOTTOM_OFFSET + BAR_HEIGHT + spacing.sm,
    width: 44, height: 44, borderRadius: radius.pill,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
});
