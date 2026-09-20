import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Live connectivity for the offline banner — deliberately separate from
// lib/query-persist.ts's onlineManager wiring (that one drives React
// Query's internal pause/resume behavior; this one is just "should the UI
// show a banner right now", so a component can use it without pulling in
// query internals).
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine);
      const onOnline = () => setIsOnline(true);
      const onOffline = () => setIsOnline(false);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
    return NetInfo.addEventListener(state => setIsOnline(!!state.isConnected));
  }, []);

  return isOnline;
}
