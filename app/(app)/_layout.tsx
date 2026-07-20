import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/lib/auth';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pokeball } from '@/components/Pokeball';
import { colors } from '@/lib/theme';

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="pokedex"
        options={{
          title: 'Pokédex',
          tabBarIcon: ({ focused, size }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
              <Pokeball size={size - 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={size}
              color={focused ? colors.danger : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="pokemon/[num]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapFocused: { transform: [{ scale: 1.1 }] },
});
