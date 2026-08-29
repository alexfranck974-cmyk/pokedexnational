import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

// Native implementation — synchronous/eager, unchanged from before this file
// existed. See sentry.web.ts (Metro/Expo resolves that instead on web) for
// why web needs a different strategy: RN ships one bundle regardless of
// import style, so there's nothing to gain from deferring here, and startup-
// crash coverage matters more on native than shaving bundle weight does.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export function captureException(error: unknown, context?: Parameters<typeof Sentry.captureException>[1]) {
  if (!dsn) return;
  Sentry.captureException(error, context);
}

// Only ever called with the root layout (no props) — not generic, since
// Sentry.wrap's own typing doesn't distribute cleanly over an arbitrary P.
export function wrapRoot(Component: ComponentType<Record<string, never>>): ComponentType<Record<string, never>> {
  return Sentry.wrap(Component);
}
