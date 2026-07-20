import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/lib/auth';
import { View, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (session) return <Redirect href="/pokedex" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
