import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/lib/auth';
import { View, ActivityIndicator } from 'react-native';

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="pokedex" options={{ title: 'Pokédex' }} />
      <Tabs.Screen name="wishlist" options={{ title: 'Wishlist' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="pokemon/[num]" options={{ href: null }} />
    </Tabs>
  );
}
