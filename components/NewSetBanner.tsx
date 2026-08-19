import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUndismissedSetReleases, useDismissSetRelease } from '@/lib/set-releases';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

interface Props {
  userId?: string;
  /** ISO timestamp the user's account was created — sets announced before this
   * are filtered out even if somehow undismissed, see lib/set-releases.ts. */
  joinedAt?: string;
}

// Shows the most recently announced TCG set the user hasn't dismissed yet
// (see migration 048 + lib/set-releases.ts). "Voir" both navigates to that
// set's gallery (already-existing pinned-set route) and dismisses it —
// dismissing without viewing is also available via the ✕, and either way
// the next-most-recent undismissed set (if any) surfaces on the next render.
export function NewSetBanner({ userId, joinedAt }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const { data: releases = [] } = useUndismissedSetReleases(userId, joinedAt);
  const dismiss = useDismissSetRelease();
  const styles = useThemedStyles((colors) => ({
    banner: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.primarySoft, borderRadius: radius.md,
      padding: spacing.sm, marginBottom: spacing.sm,
    },
    text: { flex: 1 },
    title: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.text },
    subtitle: { fontSize: 11, fontFamily: fonts.body, color: colors.textMuted, marginTop: 1 },
    viewBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
    viewBtnText: { fontSize: 12, fontFamily: fonts.bodyBold, color: 'white' },
    closeBtn: { padding: 4 },
  }));

  if (releases.length === 0) return null;
  const release = releases[0];
  const label = setFlagLabel(release.setName, release.region);

  return (
    <View style={styles.banner}>
      <Ionicons name="sparkles" size={18} color={colors.primary} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{t('newSetBanner.newSet', { label })}</Text>
        {releases.length > 1 && (
          <Text style={styles.subtitle}>
            {t(releases.length - 1 > 1 ? 'newSetBanner.morePlural' : 'newSetBanner.moreSingular', { n: releases.length - 1 })}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => { dismiss.mutate(release.setId); router.push(`/pinned-set/${release.setId}` as never); }}
        style={styles.viewBtn}>
        <Text style={styles.viewBtnText}>{t('newSetBanner.view')}</Text>
      </Pressable>
      <Pressable onPress={() => dismiss.mutate(release.setId)} hitSlop={8} style={styles.closeBtn}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
