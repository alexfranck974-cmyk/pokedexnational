import { Animated, View, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, radius, spacing } from '@/lib/theme';
import { withAlpha } from '@/lib/color-utils';
import { useTabBarVisibility } from '@/lib/tab-bar-visibility';
import { PokedexDeviceIcon } from './PokedexDeviceIcon';

const BAR_SIDE_INSET = spacing.lg;
const BAR_BOTTOM_OFFSET = spacing.lg;
const BAR_HEIGHT = 62;

interface TabDef {
  href: '/dashboard' | '/pokedex' | '/friends';
  accessibilityLabel: string;
  // Which pathnames should show this tab as active — wider than just the
  // tab's own root, since screens that used to be hidden Tabs.Screen
  // siblings of these 3 (wishlist, a Pokémon detail, the marché, ...) are
  // now Stack.Screen pushes living outside this navigator entirely, but
  // still conceptually "under" one of these 3 top-level places.
  matches: (pathname: string) => boolean;
}

// Rendered once at the outer Stack level (app/(app)/_layout.tsx), not as a
// react-navigation `tabBar` — this app's actual navigable surface is far
// wider than the 3 real Tabs.Screen (dashboard/pokedex/friends): 10 more
// screens (wishlist, a Pokémon's detail, an extension page, ...) are pushed
// on top of the Tabs navigator as plain Stack screens, and this bar needs to
// stay visible and correctly highlighted on all of them too — something a
// react-navigation-driven tabBar render prop can't do, since it only knows
// about its own navigator's state. Pathname-driven instead.
export function FloatingTabBar({ hasSocialBadge }: { hasSocialBadge: boolean }) {
  const { colors } = useTheme();
  const { translateY } = useTabBarVisibility();
  const router = useRouter();
  const pathname = usePathname();

  const tabs: TabDef[] = [
    { href: '/dashboard', accessibilityLabel: 'Accueil', matches: p => p.startsWith('/dashboard') },
    {
      href: '/pokedex', accessibilityLabel: 'Pokédex',
      matches: p => ['/pokedex', '/wishlist', '/favorites', '/pokemon', '/pinned-set', '/binder', '/artist']
        .some(prefix => p === prefix || p.startsWith(`${prefix}/`)),
    },
    {
      href: '/friends', accessibilityLabel: 'Social',
      matches: p => ['/friends', '/market', '/news'].some(prefix => p === prefix || p.startsWith(`${prefix}/`)),
    },
  ];

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: withAlpha(colors.surface, 0.86),
          borderColor: withAlpha(colors.border, 0.6),
          transform: [{ translateY }],
        },
      ]}>
      {tabs.map(tab => {
        const isFocused = tab.matches(pathname);
        const color = isFocused ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={tab.href}
            onPress={() => { if (pathname !== tab.href) router.push(tab.href); }}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityState={{ selected: isFocused }}>
            {tab.href === '/dashboard' && (
              <Ionicons name={isFocused ? 'trophy' : 'trophy-outline'} size={24} color={color} />
            )}
            {tab.href === '/pokedex' && (
              <View style={[styles.iconWrap, isFocused && styles.iconWrapFocused]}>
                <PokedexDeviceIcon size={22} />
              </View>
            )}
            {tab.href === '/friends' && (
              <View>
                <Ionicons name={isFocused ? 'people' : 'people-outline'} size={24} color={color} />
                {hasSocialBadge && <View style={[styles.requestDot, { borderColor: colors.surface }]} />}
              </View>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: BAR_SIDE_INSET,
    right: BAR_SIDE_INSET,
    bottom: BAR_BOTTOM_OFFSET,
    height: BAR_HEIGHT,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapFocused: { transform: [{ scale: 1.1 }] },
  requestDot: {
    position: 'absolute', top: -1, right: -3, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#ef4444', borderWidth: 1.5,
  },
});
