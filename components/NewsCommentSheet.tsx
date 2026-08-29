import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFriendNewsComments, useAddFriendNewsComment } from '@/lib/friend-news';
import { BubbleSheet } from './BubbleSheet';
import { useThemedStyles, useTheme, radius, spacing, fonts } from '@/lib/theme';
import { useLocale, useT } from '@/lib/locale';
import type { Locale } from '@/lib/locale';

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  newsId: string | null;
  tint: string;
  onClose: () => void;
}

export function NewsCommentSheet({ newsId, tint, onClose }: Props) {
  const { colors } = useTheme();
  const { locale } = useLocale();
  const t = useT();
  const [comment, setComment] = useState('');

  const { data: comments = [], isLoading } = useFriendNewsComments(newsId);
  const addComment = useAddFriendNewsComment();

  const styles = useThemedStyles((colors) => ({
    body: { padding: spacing.md, gap: spacing.md },
    commentsScroll: { maxHeight: 320 },
    comments: { gap: spacing.sm },
    comment: { gap: 2 },
    commentHead: { flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const },
    commentAuthor: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.text },
    commentDate: { fontSize: 10, fontFamily: fonts.mono, color: colors.textDim },
    commentBody: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },
    inputRow: { flexDirection: 'row' as const, gap: spacing.sm, alignItems: 'flex-end' as const },
    input: {
      flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, maxHeight: 90,
      fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    sendBtn: { backgroundColor: tint, borderRadius: radius.pill, padding: 10 },
  }));

  const submitComment = async () => {
    if (!comment.trim()) return;
    try {
      await addComment.mutateAsync({ newsId: newsId!, body: comment });
      setComment('');
    } catch {
      // useAddFriendNewsComment already toasts on error
    }
  };

  return (
    <BubbleSheet visible={newsId !== null} onClose={onClose} tint={tint} title={t('news.commentsTitle')}>
      <View style={styles.body}>
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <ScrollView style={styles.commentsScroll} contentContainerStyle={styles.comments}>
            {comments.length === 0 && <Text style={styles.empty}>{t('news.noCommentsYet')}</Text>}
            {comments.map(c => (
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
        <View style={styles.inputRow}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('news.addCommentPlaceholder')}
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={500}
            style={styles.input}
          />
          <Pressable onPress={submitComment} disabled={!comment.trim() || addComment.isPending} style={styles.sendBtn}>
            <Ionicons name="send" size={16} color="white" />
          </Pressable>
        </View>
      </View>
    </BubbleSheet>
  );
}
