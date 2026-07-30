import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { type FriendNewsItem, NEWS_REACTIONS, type NewsReaction, useDismissFriendNews, useReactToFriendNews } from '@/lib/friend-news';
import { useMotion } from '@/lib/motion';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

interface Props {
  item: FriendNewsItem | null;
}

// Same card proportions as CaptureEffect/CardZoomModal, so this reads consistently
// with the rest of the app's card-zoom moments.
const CARD_RATIO = 0.72;
const CARD_WIDTH = 138;
const CARD_HEIGHT = CARD_WIDTH / CARD_RATIO;
const GOLD = '#fbbf24';

export function FriendNewsPopup({ item }: Props) {
  const { animationsEnabled } = useMotion();
  const dismiss = useDismissFriendNews();
  const react = useReactToFriendNews();
  const appear = useRef(new Animated.Value(0)).current;
  const styles = useThemedStyles((colors, shadow) => ({
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 1000 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    card: {
      width: 300, backgroundColor: colors.surface, borderRadius: radius.bubble,
      padding: spacing.lg, alignItems: 'center' as const, gap: spacing.sm, ...shadow.md,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    avatarText: { fontSize: 17, fontFamily: fonts.display, color: 'white' },
    headline: { fontSize: 15, fontFamily: fonts.bodyBold, color: colors.text, textAlign: 'center' as const },
    cardGlow: {
      width: CARD_WIDTH + 20, height: CARD_HEIGHT + 20, borderRadius: 14,
      alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: GOLD + '1f', shadowColor: GOLD, shadowOpacity: 0.7, shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 }, elevation: 12, marginVertical: spacing.xs,
    },
    cardImg: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 6 },
    cardName: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    reactionRow: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.xs },
    reactionBtn: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    reactionEmoji: { fontSize: 20 },
    closeBtn: { marginTop: spacing.xs },
    closeText: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim },
  }));

  useEffect(() => {
    if (!item) return;
    if (!animationsEnabled) { appear.setValue(1); return; }
    appear.setValue(0);
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, animationsEnabled]);

  if (!item) return null;

  const close = () => dismiss.mutate(item.id);
  const onReact = (emoji: NewsReaction) => {
    react.mutate({ newsId: item.id, emoji });
    close();
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={close} />
      <Animated.View
        style={[
          styles.card,
          { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        ]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.authorName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.headline}>{item.authorName} a obtenu une carte {item.rarityLabel} !</Text>
        <View style={styles.cardGlow}>
          <Image source={{ uri: item.imageLarge ?? item.imageSmall }} style={styles.cardImg} resizeMode="contain" />
        </View>
        <Text style={styles.cardName} numberOfLines={1}>{item.cardName}</Text>
        <View style={styles.reactionRow}>
          {NEWS_REACTIONS.map(emoji => (
            <Pressable key={emoji} onPress={() => onReact(emoji)} style={styles.reactionBtn} hitSlop={4}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={close} style={styles.closeBtn} hitSlop={8}>
          <Text style={styles.closeText}>Fermer</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
