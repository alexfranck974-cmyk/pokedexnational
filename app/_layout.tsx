import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { RootSiblingParent } from 'react-native-root-siblings';
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Karla_400Regular, Karla_700Bold } from '@expo-google-fonts/karla';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider } from '@/lib/theme';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';

export default function RootLayout() {
  const queryClient = useMemo(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: true, retry: 1 },
      },
    }),
    [],
  );

  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Karla_400Regular,
    Karla_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <QueryClientProvider client={queryClient}>
          <RootSiblingParent>
            <Stack screenOptions={{ headerShown: false }} />
          </RootSiblingParent>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
