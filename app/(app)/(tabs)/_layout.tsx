import { Tabs } from 'expo-router';

// The 3 real bottom-tab screens only — everything else that used to live
// here as a hidden (href:null) Tabs.Screen sibling now lives one level up,
// in app/(app)/_layout.tsx's Stack, as a proper pushed screen (see that
// file's own comment for why). tabBar is null: the visible bottom bar is
// now rendered once at the outer Stack level (FloatingTabBar, driven by
// pathname) so it stays visible on every screen, tab or not — not just
// these 3 — instead of being tied to this inner navigator's own state.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{ headerShown: false, animation: 'none' }}>
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="pokedex" />
      <Tabs.Screen name="friends" />
    </Tabs>
  );
}
