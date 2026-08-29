import { QueryCache, QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { RootSiblingParent } from 'react-native-root-siblings';
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Karla_400Regular, Karla_700Bold } from '@expo-google-fonts/karla';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider } from '@/lib/theme';
import { MotionProvider } from '@/lib/motion';
import { LocaleProvider } from '@/lib/locale';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { toast } from '@/lib/toast';
import { initSentry, wrapRoot } from '@/lib/sentry';

initSentry();

// Module-level (not per-render) so the throttle survives across the app's
// whole lifetime, not just one RootLayout instance.
let lastFetchErrorToastAt = 0;
const FETCH_ERROR_TOAST_THROTTLE_MS = 4000;

function RootLayout() {
  const queryClient = useMemo(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: true, retry: 1 },
      },
      // Most query failures are silent today — the screen just keeps showing
      // stale/empty data with no signal anything went wrong. This only speaks
      // up for a *first-load* failure (no cached data to fall back on); a
      // background refetch failing while stale data is still on screen stays
      // silent, since that's far less disruptive and shouldn't spam a toast
      // every time one of 85+ query hooks has a network hiccup.
      queryCache: new QueryCache({
        onError: (_error, query) => {
          if (query.state.data !== undefined) return;
          const now = Date.now();
          if (now - lastFetchErrorToastAt < FETCH_ERROR_TOAST_THROTTLE_MS) return;
          lastFetchErrorToastAt = now;
          toast('Impossible de charger ces données, vérifie ta connexion.');
        },
      }),
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <MotionProvider>
            <LocaleProvider>
              <ThemedStatusBar />
              <QueryClientProvider client={queryClient}>
                <RootSiblingParent>
                  <ErrorBoundary>
                    <Stack screenOptions={{ headerShown: false }} />
                  </ErrorBoundary>
                </RootSiblingParent>
              </QueryClientProvider>
            </LocaleProvider>
          </MotionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
