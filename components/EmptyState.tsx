import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pokeball } from './Pokeball';
import { useTheme, useThemedStyles, spacing, fonts } from '@/lib/theme';

interface Props {
  /** Ionicons name — overrides the default muted Pokéball for contexts where
   * a more specific icon reads better (e.g. "search" for a no-results state,
   * as opposed to "nothing here yet"). */
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  hint: string;
}

// Every empty state in the app used to be a lone line of gray italic text —
// same Pokéball motif used everywhere else (tile overlays, badges) instead of
// a generic icon, so an empty list still feels like part of this app rather
// than a blank fallback.
export function EmptyState({ icon, title, hint }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    wrap: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.sm, padding: spacing.xl },
    iconWrap: { opacity: 0.45, marginBottom: 2 },
    title: { fontSize: 17, fontFamily: fonts.display, color: colors.text, textAlign: 'center' as const },
    hint: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const, fontStyle: title ? 'normal' as const : 'italic' as const },
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        {icon ? <Ionicons name={icon} size={40} color={colors.textDim} /> : <Pokeball size={40} muted />}
      </View>
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}
