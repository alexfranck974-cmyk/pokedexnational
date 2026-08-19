import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/auth';
import {
  useFeedbackComments, useAddFeedbackComment, useUpdateFeedbackStatus, getStatusLabel,
  type FeedbackKind, type FeedbackStatus,
} from '@/lib/feedback';
import { FeedbackStatusBadge } from './FeedbackStatusBadge';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, useTheme, radius, spacing, fonts } from '@/lib/theme';
import { useLocale, useT } from '@/lib/locale';
import type { Locale } from '@/lib/locale';

const TINT = '#8b5cf6';
const STATUS_OPTIONS: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export interface FeedbackDetailTarget {
  id: string;
  kind: FeedbackKind;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  userId: string;
  authorName?: string;
}

interface Props {
  item: FeedbackDetailTarget | null;
  onClose: () => void;
  isAdmin: boolean;
}

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FeedbackDetailModal({ item, onClose, isAdmin }: Props) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const t = useT();
  const { session } = useSession();
  const myId = session?.user.id;
  const [comment, setComment] = useState('');

  const { data: comments = [], isLoading } = useFeedbackComments(item?.id ?? null);
  const addComment = useAddFeedbackComment();
  const updateStatus = useUpdateFeedbackStatus();

  const styles = useThemedStyles((colors) => ({
    body: { padding: spacing.md, gap: spacing.md, maxHeight: 460 },
    headRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
    kindBadge: { fontSize: 11, fontFamily: fonts.bodyBold, color: TINT },
    meta: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim },
    message: { fontSize: 14, fontFamily: fonts.body, color: colors.text, lineHeight: 20 },
    statusRow: { flexDirection: 'row' as const, gap: spacing.xs, flexWrap: 'wrap' as const },
    statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    statusChipActive: { backgroundColor: TINT, borderColor: TINT },
    statusChipText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted },
    statusChipTextActive: { color: 'white' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    commentsScroll: { maxHeight: 180 },
    comments: { gap: spacing.sm },
    comment: { gap: 2 },
    commentHead: { flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const },
    commentAuthor: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
    commentDate: { fontSize: 10, fontFamily: fonts.mono, color: colors.textDim },
    commentBody: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    empty: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
    inputRow: { flexDirection: 'row' as const, gap: spacing.sm, alignItems: 'flex-end' as const },
    input: {
      flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, maxHeight: 90,
      fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    sendBtn: { backgroundColor: TINT, borderRadius: radius.pill, padding: 10 },
  }));

  if (!item) return null;
  const canComment = isAdmin || item.userId === myId;

  const submitComment = async () => {
    if (!myId || !comment.trim()) return;
    try {
      await addComment.mutateAsync({ feedbackId: item.id, authorId: myId, body: comment });
      setComment('');
    } catch {}
  };

  return (
    <BubbleSheet visible={!!item} onClose={onClose} tint={TINT} title={t(item.kind === 'bug' ? 'feedback.kindBug' : 'feedback.kindSuggestion')} sizing="standard">
      <View style={styles.body}>
        <View style={styles.headRow}>
          <FeedbackStatusBadge status={item.status} />
          {item.authorName && <Text style={styles.meta}>{item.authorName}</Text>}
          <Text style={styles.meta}>{formatDate(item.createdAt, locale)}</Text>
        </View>

        <Text style={styles.message}>{item.message}</Text>

        {isAdmin && (
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((s) => (
              <Pressable
                key={s}
                disabled={updateStatus.isPending}
                onPress={() => s !== item.status && updateStatus.mutate({ feedbackId: item.id, status: s })}
                style={[styles.statusChip, s === item.status && styles.statusChipActive]}>
                <Text style={[styles.statusChipText, s === item.status && styles.statusChipTextActive]}>
                  {getStatusLabel(s, locale)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <ScrollView style={styles.commentsScroll} contentContainerStyle={styles.comments}>
            {comments.length === 0 && <Text style={styles.empty}>{t('feedback.noRepliesYet')}</Text>}
            {comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentHead}>
                  <Text style={styles.commentAuthor}>{c.authorName}</Text>
                  <Text style={styles.commentDate}>{formatDate(c.createdAt, locale)}</Text>
                </View>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {canComment && (
          <View style={styles.inputRow}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t(isAdmin ? 'feedback.replyPlaceholder' : 'feedback.addMessagePlaceholder')}
              placeholderTextColor={colors.textDim}
              multiline
              style={styles.input}
            />
            <Pressable onPress={submitComment} disabled={!comment.trim() || addComment.isPending} style={styles.sendBtn}>
              <Ionicons name="send" size={16} color="white" />
            </Pressable>
          </View>
        )}
      </View>
    </BubbleSheet>
  );
}
