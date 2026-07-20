import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { RootSiblingParent } from 'react-native-root-siblings';

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
        <RootSiblingParent>
          <Stack screenOptions={{ headerShown: false }} />
        </RootSiblingParent>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
