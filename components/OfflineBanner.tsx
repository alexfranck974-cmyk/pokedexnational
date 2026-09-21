import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/lib/network-status';
import { useThemedStyles, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

// Persistent state indicator, not a one-off toast (unlike NotificationBanner) —
// stays up for as long as the device is offline instead of auto-hiding, since
// "you're looking at possibly-stale cached data" (see lib/query-persist.ts)
// remains true the whole time, not just for a few seconds.
export function OfflineBanner() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const t = useT();
  const styles = useThemedStyles((colors) => ({
    wrap: {
      position: 'absolute' as const, top: insets.top, left: 0, right: 0, zIndex: 2000,
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6,
      paddingVertical: 6, backgroundColor: colors.warningBg,
    },
    text: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.warning },
  }));

  if (isOnline) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={14} color={styles.text.color} />
      <Text style={styles.text}>{t('common.offlineBanner')}</Text>
    </View>
  );
}
