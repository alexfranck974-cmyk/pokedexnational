import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/auth';
import {
  useMyFeedback, useSubmitFeedback, usePublicSuggestions, useMyVotes, useToggleVote,
  useIsAdmin, useAdminFeedback,
  type FeedbackKind, type FeedbackItem, type SuggestionItem, type AdminFeedbackItem,
} from '@/lib/feedback';
import { FeedbackStatusBadge } from '@/components/FeedbackStatusBadge';
import { FeedbackDetailModal, type FeedbackDetailTarget } from '@/components/FeedbackDetailModal';
import { RefreshButton } from '@/components/RefreshButton';
import { useBackTo } from '@/lib/navigation';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE } from '@/lib/theme';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useHideOnScrollProps } from '@/lib/tab-bar-visibility';

const TINT = '#8b5cf6';
type Segment = 'suggestions' | 'mine' | 'admin';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Public suggestion board (votable) + a private "mes tickets" history (bug
// reports and suggestions alike, own submissions only) + an admin-only triage
// view — all three read/write the same `feedback` table, see
// 040_feedback_status_votes_comments.sql for the RLS split. Reached from
// Settings, not a bottom-bar tab (same pattern as market.tsx/favorites.tsx).
export default function FeedbackScreen() {
  const goBack = useBackTo('/settings');
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh();
  const hideOnScrollProps = useHideOnScrollProps();

  const { data: isAdmin = false } = useIsAdmin(userId);
  const [segment, setSegment] = useState<Segment>('suggestions');

  const { data: suggestions = [], isLoading: loadingSuggestions } = usePublicSuggestions();
  const { data: myVotes = new Set<string>() } = useMyVotes(userId);
  const toggleVote = useToggleVote(userId);

  const { data: myFeedback = [] } = useMyFeedback(userId);
  const submitFeedback = useSubmitFeedback();
  const [composeKind, setComposeKind] = useState<FeedbackKind>('suggestion');
  const [composeMessage, setComposeMessage] = useState('');

  const { data: adminItems = [], isLoading: loadingAdmin } = useAdminFeedback();

  const [detailTarget, setDetailTarget] = useState<FeedbackDetailTarget | null>(null);

  const submit = async () => {
    if (!userId || !composeMessage.trim()) return;
    try {
      await submitFeedback.mutateAsync({ userId, kind: composeKind, message: composeMessage });
      setComposeMessage('');
    } catch {}
  };

  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      padding: spacing.md, gap: spacing.sm, ...shadow.sm,
    },
    back: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, padding: 4 },
    backText: { color: 'white', fontSize: 14, fontFamily: fonts.body },
    heroTitle: { fontSize: 17, fontFamily: fonts.display, color: 'white' },
    body: { padding: spacing.md, paddingBottom: spacing.md + TAB_BAR_CLEARANCE, gap: spacing.md },
    segmentRow: { flexDirection: 'row' as const, gap: spacing.xs },
    segmentChip: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const },
    segmentChipActive: { backgroundColor: TINT },
    segmentChipText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted },
    segmentChipTextActive: { color: 'white' },
    card: {
      flexDirection: 'row' as const, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md,
      padding: spacing.sm, ...shadow.sm,
    },
    voteBtn: { alignItems: 'center' as const, justifyContent: 'center' as const, width: 44, gap: 2, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
    voteBtnActive: { backgroundColor: `${TINT}22` },
    voteCount: { fontSize: 13, fontFamily: fonts.monoBold, color: colors.textMuted },
    voteCountActive: { color: TINT },
    cardBody: { flex: 1, gap: 4 },
    cardMessage: { fontSize: 14, fontFamily: fonts.body, color: colors.text },
    cardMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, flexWrap: 'wrap' as const },
    cardMeta: { fontSize: 11, fontFamily: fonts.mono, color: colors.textDim },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const, padding: spacing.md, textAlign: 'center' as const },
    composeRow: { gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    kindRow: { flexDirection: 'row' as const, gap: spacing.sm },
    kindChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    kindChipActive: { backgroundColor: TINT },
    kindChipText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    kindChipTextActive: { color: 'white' },
    composeInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, minHeight: 70,
      fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt, textAlignVertical: 'top' as const,
    },
    sendBtn: {
      flexDirection: 'row' as const, gap: 6, backgroundColor: TINT, paddingVertical: 10, borderRadius: radius.md,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    sendBtnText: { fontFamily: fonts.bodyBold, color: 'white', fontSize: 13 },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Pressable onPress={goBack} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color="white" />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.heroTitle}>Suggestions & Support</Text>
        <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        {...hideOnScrollProps}>

        <View style={styles.segmentRow}>
          <Pressable onPress={() => setSegment('suggestions')} style={[styles.segmentChip, segment === 'suggestions' && styles.segmentChipActive]}>
            <Text style={[styles.segmentChipText, segment === 'suggestions' && styles.segmentChipTextActive]}>Suggestions</Text>
          </Pressable>
          <Pressable onPress={() => setSegment('mine')} style={[styles.segmentChip, segment === 'mine' && styles.segmentChipActive]}>
            <Text style={[styles.segmentChipText, segment === 'mine' && styles.segmentChipTextActive]}>Mes tickets</Text>
          </Pressable>
          {isAdmin && (
            <Pressable onPress={() => setSegment('admin')} style={[styles.segmentChip, segment === 'admin' && styles.segmentChipActive]}>
              <Text style={[styles.segmentChipText, segment === 'admin' && styles.segmentChipTextActive]}>Admin</Text>
            </Pressable>
          )}
        </View>

        {segment === 'suggestions' && (
          loadingSuggestions ? <ActivityIndicator /> : suggestions.length === 0 ? (
            <Text style={styles.empty}>Aucune suggestion pour l'instant — sois le premier à en proposer une !</Text>
          ) : suggestions.map((s: SuggestionItem) => {
            const voted = myVotes.has(s.id);
            return (
              <Pressable
                key={s.id}
                style={styles.card}
                onPress={() => setDetailTarget({ id: s.id, kind: 'suggestion', message: s.message, status: s.status, createdAt: s.createdAt, userId: s.userId, authorName: s.authorName })}>
                <Pressable
                  onPress={() => userId && toggleVote.mutate({ feedbackId: s.id, voted })}
                  style={[styles.voteBtn, voted && styles.voteBtnActive]}
                  hitSlop={4}>
                  <Ionicons name={voted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={18} color={voted ? TINT : colors.textMuted} />
                  <Text style={[styles.voteCount, voted && styles.voteCountActive]}>{s.voteCount}</Text>
                </Pressable>
                <View style={styles.cardBody}>
                  <Text style={styles.cardMessage} numberOfLines={3}>{s.message}</Text>
                  <View style={styles.cardMetaRow}>
                    <FeedbackStatusBadge status={s.status} />
                    <Text style={styles.cardMeta}>{s.authorName} · {formatDate(s.createdAt)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

        {segment === 'mine' && (
          <>
            <View style={styles.composeRow}>
              <View style={styles.kindRow}>
                <Pressable onPress={() => setComposeKind('suggestion')} style={[styles.kindChip, composeKind === 'suggestion' && styles.kindChipActive]}>
                  <Text style={[styles.kindChipText, composeKind === 'suggestion' && styles.kindChipTextActive]}>Suggestion</Text>
                </Pressable>
                <Pressable onPress={() => setComposeKind('bug')} style={[styles.kindChip, composeKind === 'bug' && styles.kindChipActive]}>
                  <Text style={[styles.kindChipText, composeKind === 'bug' && styles.kindChipTextActive]}>Bug</Text>
                </Pressable>
              </View>
              <TextInput
                value={composeMessage}
                onChangeText={setComposeMessage}
                placeholder={composeKind === 'bug' ? 'Décris le bug que tu as rencontré...' : "Décris ton idée d'amélioration..."}
                placeholderTextColor={colors.textDim}
                multiline
                style={styles.composeInput}
              />
              <Pressable onPress={submit} disabled={!composeMessage.trim() || submitFeedback.isPending} style={styles.sendBtn}>
                <Ionicons name="send-outline" size={14} color="white" />
                <Text style={styles.sendBtnText}>{submitFeedback.isPending ? 'Envoi…' : 'Envoyer'}</Text>
              </Pressable>
            </View>

            {myFeedback.length === 0 ? (
              <Text style={styles.empty}>Tu n'as encore rien envoyé.</Text>
            ) : myFeedback.map((f: FeedbackItem) => (
              <Pressable key={f.id} style={styles.card} onPress={() => setDetailTarget(f)}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardMessage} numberOfLines={3}>{f.message}</Text>
                  <View style={styles.cardMetaRow}>
                    <FeedbackStatusBadge status={f.status} />
                    <Text style={styles.cardMeta}>{f.kind === 'bug' ? 'Bug' : 'Suggestion'} · {formatDate(f.createdAt)}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {segment === 'admin' && isAdmin && (
          loadingAdmin ? <ActivityIndicator /> : adminItems.length === 0 ? (
            <Text style={styles.empty}>Rien à traiter.</Text>
          ) : adminItems.map((a: AdminFeedbackItem) => (
            <Pressable
              key={a.id}
              style={styles.card}
              onPress={() => setDetailTarget({ id: a.id, kind: a.kind, message: a.message, status: a.status, createdAt: a.createdAt, userId: a.userId, authorName: a.authorName })}>
              <View style={styles.cardBody}>
                <Text style={styles.cardMessage} numberOfLines={2}>{a.message}</Text>
                <View style={styles.cardMetaRow}>
                  <FeedbackStatusBadge status={a.status} />
                  <Text style={styles.cardMeta}>{a.kind === 'bug' ? 'Bug' : 'Suggestion'} · {a.authorName} · {formatDate(a.createdAt)}</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <FeedbackDetailModal item={detailTarget} onClose={() => setDetailTarget(null)} isAdmin={isAdmin} />
    </SafeAreaView>
  );
}
