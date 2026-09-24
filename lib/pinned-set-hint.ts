import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'pinned_set_hint_dismissed';

async function getStoredDismissed(): Promise<boolean> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
    : await SecureStore.getItemAsync(STORAGE_KEY);
  return raw === 'true';
}

async function setStoredDismissed(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, 'true');
}

// The "cocher une carte ici..." explainer on an extension's screen used to
// render on every single visit — this shows it once per device, dismissed
// permanently after the first close. Defaults to dismissed=true (hidden)
// until the stored flag is read, not dismissed=false — the alternative would
// flash the banner for a frame on every RETURNING visit while the read
// resolves; this way only the very first-ever visit has a (much rarer,
// one-time) brief delay before it pops in.
export function usePinnedSetHint() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    let alive = true;
    getStoredDismissed().then(d => { if (alive) setDismissed(d); });
    return () => { alive = false; };
  }, []);
  const dismiss = () => { setDismissed(true); setStoredDismissed(); };
  return { dismissed, dismiss };
}
