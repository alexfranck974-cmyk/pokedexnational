import * as Haptics from 'expo-haptics';

// A light tap for adding a card to the collection — deliberately not the
// heavier "success" notification pattern, since this fires every time while
// browsing a big collection and shouldn't get tiring. expo-haptics already
// no-ops safely on platforms/browsers without vibration support (desktop web),
// no Platform guard needed here.
export function hapticCardAdded() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
