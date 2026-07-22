import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Expo Router replaces the default web HTML shell with this file's output.
// PWA installability (manifest + icons) lives here since it's the one place
// that reaches the real <head>, before any React Native view renders.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="description" content="Suis ta progression dans le Pokédex National à travers ta collection de cartes Pokémon TCG." />

        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#c81f34" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#d33a4d" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/pwa/icon-192.png" />
        <link rel="apple-touch-icon" href="/pwa/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pokédex" />

        {/* Prevents an unstyled flash of a scrollable body — Expo's recommended web reset. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
