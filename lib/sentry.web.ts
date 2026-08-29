import type { ComponentType } from 'react';
import type * as SentryType from '@sentry/react-native';

// Web implementation — Metro/Expo resolves this over lib/sentry.ts for web
// builds. @sentry/react-native's web bundle turned out to be the single
// largest chunk in the whole app (~1.5MB minified, found via `npx expo
// export --platform web` + inspecting dist/_expo/static/js/web/) — it was
// being pulled in by a plain top-level `import * as Sentry` at the root of
// app/_layout.tsx, so every route (including /login, before the user is
// even signed in) blocked on it. A real dynamic import() here is a genuine
// Metro code-split boundary on web, fetched in parallel instead of gating
// first paint — the only cost is a brief window (until the chunk resolves)
// where an error wouldn't be captured, which the app's own ErrorBoundary
// (components/ErrorBoundary.tsx) doesn't cover either way since it also
// goes through captureException below.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let sentryPromise: Promise<typeof SentryType> | null = null;
function loadSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react-native');
  return sentryPromise;
}

export function initSentry() {
  if (!dsn) return;
  loadSentry().then(Sentry => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.2,
      environment: __DEV__ ? 'development' : 'production',
    });
  });
}

export function captureException(error: unknown, context?: Parameters<typeof SentryType.captureException>[1]) {
  if (!dsn) return;
  loadSentry().then(Sentry => Sentry.captureException(error, context));
}

// Sentry.wrap needs the real module synchronously to produce the wrapped
// component as this file's own export, which a dynamic import can't give us
// here — skip it on web and rely on the app's existing custom ErrorBoundary
// (which already calls captureException itself) for render-error capture.
export function wrapRoot(Component: ComponentType<Record<string, never>>): ComponentType<Record<string, never>> {
  return Component;
}
