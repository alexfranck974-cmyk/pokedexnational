import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';
import { IconBubble } from './IconBubble';
import { type FriendNewsItem, REACTION_EMOJI_PALETTE } from '@/lib/friend-news';
import { SEALED_PRODUCT_TYPES } from '@/lib/sealed-products';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useT, useTRich } from '@/lib/locale';
import { withReturnTo } from '@/lib/navigation';

export interface NewsGroup { authorId: string; authorName: string; items: FriendNewsItem[]; }

// Consecutive same-author runs collapse into one row — a friend who lands
// several notable pulls in a row shouldn't push everyone else off-screen.
// Only chase_card items merge this way (the multi-thumb strip only makes
// sense for card art) — every other event type always renders its own row.
export function groupConsecutiveByAuthor(items: FriendNewsItem[]): NewsGroup[] {
  const groups: NewsGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    const canMerge = item.eventType === 'chase_card' && last?.items[0].eventType === 'chase_card' && last.authorId === item.authorId;
    if (canMerge) last.items.push(item);
    else groups.push({ authorId: item.authorId, authorName: item.authorName, items: [item] });
  }
  return groups;
}

interface RowProps {
  item: FriendNewsItem;
  onOpenCard: (item: FriendNewsItem) => void;
  /** Where "Retour" should land when a deep link (pinned-set/binder) is followed from this row. */
  from: string;
  /** Omit both to render a plain, non-interactive row (e.g. a compact preview) — pass both for the full news page's reaction palette + comment button. */
  onReact?: (newsId: string, emoji: string) => void;
  onComment?: (item: FriendNewsItem) => void;
}

export function NewsRow({ item, onOpenCard, from, onReact, onComment }: RowProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const tRich = useTRich();
  const interactive = !!onReact && !!onComment;
  const styles = useThemedStyles((colors, shadow) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    rowStack: { gap: spacing.xs },
    top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    newsThumb: { width: 56, height: 78, borderRadius: 4 },
    newsText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    newsTextBold: { fontFamily: fonts.bodyBold },
    newsRowInfo: { flex: 1, gap: 3 },
    footer: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs, paddingLeft: 48 },
    emojiBtn: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: radius.pill, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
    emojiBtnActive: { backgroundColor: colors.primarySoft },
    emojiText: { fontSize: 14 },
    emojiCount: { fontSize: 10, fontFamily: fonts.mono, color: colors.textMuted },
    commentBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, marginLeft: 'auto' as const },
    commentText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  }));

  const footer = interactive && (
    <View style={styles.footer}>
      {REACTION_EMOJI_PALETTE.map(emoji => (
        <Pressable key={emoji} onPress={() => onReact!(item.id, emoji)} style={[styles.emojiBtn, item.myReaction === emoji && styles.emojiBtnActive]}>
          <Text style={styles.emojiText}>{emoji}</Text>
          {item.reactionCounts[emoji] > 0 && <Text style={styles.emojiCount}>{item.reactionCounts[emoji]}</Text>}
        </Pressable>
      ))}
      <Pressable onPress={() => onComment!(item)} style={styles.commentBtn} hitSlop={6}>
        <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
        {item.commentCount > 0 && <Text style={styles.commentText}>{item.commentCount}</Text>}
      </Pressable>
    </View>
  );

  if (item.eventType === 'chase_card') {
    return (
      <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
        <Pressable onPress={() => onOpenCard(item)} style={styles.top}>
          <Avatar name={item.authorName} />
          <View style={styles.newsRowInfo}>
            <Text style={styles.newsText}>
              {tRich('friends.newsSingle', { name: item.authorName, rarity: item.rarityLabel }, styles.newsTextBold)}
            </Text>
          </View>
          <Image source={{ uri: item.imageSmall }} style={styles.newsThumb} resizeMode="contain" />
        </Pressable>
        {footer}
      </View>
    );
  }

  const icon: keyof typeof Ionicons.glyphMap =
    item.eventType === 'sealed_product' ? 'cube-outline'
    : item.eventType === 'trade_completed' ? 'swap-horizontal-outline'
    : item.eventType === 'binder_completed' ? 'albums-outline'
    : 'ribbon-outline'; // set_goal_completed

  const productLabel = t(SEALED_PRODUCT_TYPES.find(p => p.type === item.sealedProductType)?.labelKey ?? 'sealed.type.autre');
  const text =
    item.eventType === 'sealed_product'
      ? tRich('friends.newsSealedProduct', { name: item.authorName, product: productLabel, set: item.sealedSetName ?? '' }, styles.newsTextBold)
      : item.eventType === 'trade_completed'
      ? tRich('friends.newsTradeCompleted', { name: item.authorName }, styles.newsTextBold)
      : item.eventType === 'binder_completed'
      ? tRich('friends.newsBinderCompleted', { name: item.authorName, binder: item.binderName ?? '' }, styles.newsTextBold)
      : tRich('friends.newsSetGoalCompleted', { name: item.authorName, set: item.setGoalSetName ?? '' }, styles.newsTextBold);

  const onPress = () => {
    if (item.eventType === 'sealed_product' && item.sealedSetId) router.push(withReturnTo(`/pinned-set/${item.sealedSetId}`, from) as never);
    else if (item.eventType === 'set_goal_completed' && item.setGoalSetId) router.push(withReturnTo(`/pinned-set/${item.setGoalSetId}`, from) as never);
    else if (item.eventType === 'binder_completed' && item.binderId) router.push(withReturnTo(`/binder/${item.binderId}`, from) as never);
  };

  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <Pressable onPress={onPress} style={styles.top}>
        <IconBubble size={40} color={colors.primarySoft}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </IconBubble>
        <View style={styles.newsRowInfo}>
          <Text style={styles.newsText}>{text}</Text>
        </View>
      </Pressable>
      {footer}
    </View>
  );
}

export function NewsGroupRow({ group, onOpen, from }: { group: NewsGroup; onOpen: (item: FriendNewsItem) => void; from: string }) {
  const styles = useThemedStyles((colors, shadow) => ({
    row: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, ...shadow.sm,
    },
    newsRowInfo: { flex: 1, gap: 3 },
    newsText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    newsTextBold: { fontFamily: fonts.bodyBold },
    newsGroupThumbs: { maxWidth: 130, flexGrow: 0 },
    newsGroupThumbWrap: { marginRight: 4 },
    newsGroupThumb: { width: 40, height: 40 / 0.72, borderRadius: 3 },
  }));
  const tRich = useTRich();

  if (group.items.length === 1) return <NewsRow item={group.items[0]} onOpenCard={onOpen} from={from} />;
  return (
    <View style={styles.row}>
      <Avatar name={group.authorName} />
      <View style={styles.newsRowInfo}>
        <Text style={styles.newsText}>
          {tRich('friends.newsGroup', { name: group.authorName, count: group.items.length }, styles.newsTextBold)}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.newsGroupThumbs}>
        {group.items.map(item => (
          <Pressable key={item.id} onPress={() => onOpen(item)} style={styles.newsGroupThumbWrap}>
            <Image source={{ uri: item.imageSmall }} style={styles.newsGroupThumb} resizeMode="contain" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
