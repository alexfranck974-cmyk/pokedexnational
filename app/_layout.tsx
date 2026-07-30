import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { RootSiblingParent } from 'react-native-root-siblings';
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Karla_400Regular, Karla_700Bold } from '@expo-google-fonts/karla';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider } from '@/lib/theme';
import { MotionProvider } from '@/lib/motion';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

function RootLayout() {
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

  // `refetchOnWindowFocus` only fires from real browser focus/visibilitychange
  // events on web — React Native has no such event, so without forwarding
  // AppState changes into React Query's focus manager, foregrounding the app
  // on iOS/Android never refetches anything (e.g. incoming friend requests
  // received while backgrounded stay on stale cached data indefinitely).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Long-press opens the card zoom view app-wide — on web that gesture is
  // also the browser's own trigger for its native "save image" context menu
  // (Android Chrome fires a real contextmenu event; iOS Safari's callout is
  // handled separately via CSS in app/+html.tsx). Suppressing it here is what
  // makes long-press-to-zoom actually usable instead of fighting the browser.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onContextMenu = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MotionProvider>
          <ThemedStatusBar />
          <QueryClientProvider client={queryClient}>
            <RootSiblingParent>
              <Stack screenOptions={{ headerShown: false }} />
            </RootSiblingParent>
          </QueryClientProvider>
        </MotionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
