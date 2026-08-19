import { Component, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

// Class component because componentDidCatch/getDerivedStateFromError have no
// hook equivalent — the fallback UI itself is a separate function component
// so it can still use useTheme()/useT() normally.
function Fallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const styles = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' as const, justifyContent: 'center' as const, padding: spacing.xl, gap: spacing.md },
    title: { fontSize: 18, fontFamily: fonts.display, color: colors.text, textAlign: 'center' as const },
    message: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const, maxWidth: 320 },
    btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.sm },
    btnText: { color: 'white', fontFamily: fonts.bodyBold, fontSize: 14 },
  }));
  return (
    <View style={styles.screen}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <Text style={styles.title}>{t('errorBoundary.title')}</Text>
      <Text style={styles.message}>{t('errorBoundary.message')}</Text>
      <Pressable onPress={onRetry} style={styles.btn}>
        <Text style={styles.btnText}>{t('errorBoundary.retry')}</Text>
      </Pressable>
    </View>
  );
}

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return <Fallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
