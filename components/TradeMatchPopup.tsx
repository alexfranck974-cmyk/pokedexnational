import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { TradeIcon } from './TradeIcon';
import { useMotion } from '@/lib/motion';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export interface TradeMatch {
  friendId: string;
  friendName: string;
  card: { cardId: string; name: string; imageSmall: string };
}

interface Props {
  match: TradeMatch | null;
  onPropose: () => void;
  onDismiss: () => void;
}

const CARD_RATIO = 0.72;
const CARD_WIDTH = 100;
const CARD_HEIGHT = CARD_WIDTH / CARD_RATIO;
const TINT = '#2dd4bf';

// Fires the moment a card crosses into duplicate territory (2nd copy logged)
// and a friend happens to have it wishlisted — "les doublons sont flaggés comme
// disponibles automatiquement", surfaced right away rather than the user having
// to go find it in the Marché tab later.
export function TradeMatchPopup({ match, onPropose, onDismiss }: Props) {
  const { animationsEnabled } = useMotion();
  const appear = useRef(new Animated.Value(0)).current;
  const styles = useThemedStyles((colors, shadow) => ({
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 1000 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    card: {
      width: 280, backgroundColor: colors.surface, borderRadius: radius.bubble,
      padding: spacing.lg, alignItems: 'center' as const, gap: spacing.xs, ...shadow.md,
    },
    headline: { fontSize: 17, fontFamily: fonts.display, color: colors.text },
    subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const, marginBottom: spacing.xs },
    subtitleBold: { fontFamily: fonts.bodyBold, color: colors.text },
    img: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 6 },
    cardName: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
    proposeBtn: {
      flexDirection: 'row' as const, gap: 6, backgroundColor: TINT, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderRadius: radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: spacing.sm,
    },
    proposeText: { fontFamily: fonts.bodyBold, color: 'white', fontSize: 14 },
    laterBtn: { marginTop: 2 },
    laterText: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim },
  }));

  useEffect(() => {
    if (!match) return;
    if (!animationsEnabled) { appear.setValue(1); return; }
    appear.setValue(0);
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.friendId, match?.card.name, animationsEnabled]);

  if (!match) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <Animated.View
        style={[
          styles.card,
          { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        ]}>
        <TradeIcon size={26} color={TINT} />
        <Text style={styles.headline}>Échange possible !</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.subtitleBold}>{match.friendName}</Text> recherche cette carte que tu viens de dupliquer.
        </Text>
        <Image source={{ uri: match.card.imageSmall }} style={styles.img} resizeMode="contain" />
        <Text style={styles.cardName} numberOfLines={1}>{match.card.name}</Text>
        <Pressable onPress={onPropose} style={styles.proposeBtn}>
          <TradeIcon size={16} color="white" />
          <Text style={styles.proposeText}>Proposer l’échange</Text>
        </Pressable>
        <Pressable onPress={onDismiss} style={styles.laterBtn}>
          <Text style={styles.laterText}>Plus tard</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
