import { View, Text } from 'react-native';
import { Pokeball } from './Pokeball';
import { useT } from '@/lib/locale';
import { useThemedStyles, spacing, fonts } from '@/lib/theme';

// Shared header for the (auth) screens (login/signup/forgot-password) — those
// were plain left-aligned form titles with no branding at all, unlike every
// other screen in the app (hero gradients, starter sprites, Pokeball icons).
// Centered icon + name gives the entry flow the same identity as the rest of
// the app before the form itself takes over.
export function AuthBanner() {
  const t = useT();
  const styles = useThemedStyles((colors, shadow) => ({
    wrap: { alignItems: 'center' as const, gap: spacing.sm, marginBottom: spacing.lg },
    ballWrap: { ...shadow.md },
    name: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  }));
  return (
    <View style={styles.wrap}>
      <View style={styles.ballWrap}>
        <Pokeball size={52} />
      </View>
      <Text style={styles.name}>{t('auth.appName')}</Text>
    </View>
  );
}
