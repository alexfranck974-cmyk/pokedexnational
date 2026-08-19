import { Animated, Pressable, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme, radius, spacing } from '@/lib/theme';
import { withAlpha } from '@/lib/color-utils';
import { useTabBarVisibility } from '@/lib/tab-bar-visibility';

const BAR_SIDE_INSET = spacing.lg;
const BAR_BOTTOM_OFFSET = spacing.lg;
const BAR_HEIGHT = 62;

// Only these routes get a tab item — `Tabs.Screen options={{ href: null }}`
// hides a route from expo-router's own tab bar, but replacing the tab bar
// entirely means we own that filtering now. Explicit list instead of trying
// to infer it from `href`/`tabBarButton` on the descriptor, which isn't a
// react-navigation concept and isn't worth depending on.
const VISIBLE_TABS = ['dashboard', 'pokedex', 'friends'];

// Custom `tabBar` render — the default bottom-tabs bar renders in a plain
// `View`, which can't be driven by an `Animated.Value` passed through
// `tabBarStyle`. Wrapping it ourselves in `Animated.View` is the only way to
// slide it in response to the shared scroll-driven visibility state (see
// lib/tab-bar-visibility.tsx). Icons themselves aren't reimplemented — each
// route's `tabBarIcon` (defined in app/(app)/_layout.tsx's Tabs.Screen
// options) is reused as-is via the descriptor, badge dots included.
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { translateY, show } = useTabBarVisibility();

  const routes = state.routes.filter(r => VISIBLE_TABS.includes(r.name));

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
      {routes.map(route => {
        const routeIndex = state.routes.findIndex(r => r.key === route.key);
        const { options } = descriptors[route.key];
        const isFocused = state.index === routeIndex;
        const color = isFocused ? colors.primary : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          show();
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={typeof options.title === 'string' ? options.title : route.name}
            accessibilityState={{ selected: isFocused }}>
            {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
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
});
