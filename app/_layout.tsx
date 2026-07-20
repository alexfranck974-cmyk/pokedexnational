import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo } from 'react';

export default function RootLayout() {
  const queryClient = useMemo(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: true, retry: 1 },
      },
    }),
    [],
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
