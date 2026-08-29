import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { type FriendNewsItem, BRAVO_EMOJI, useDismissFriendNews, useReactToFriendNews } from '@/lib/friend-news';
import { RarityBurstCard } from './RarityBurstCard';
import { playChime } from '@/lib/chime';
import { hapticRevealSuccess } from '@/lib/haptics';
import { CHASE_GOLD } from '@/lib/rarity-tiers';
import { useMotion } from '@/lib/motion';
import { radius, spacing, fonts } from '@/lib/theme';
import { useT } from '@/lib/locale';

interface Props {
  item: FriendNewsItem | null;
  /** 'live': tapped from the Nouveautés queue — Bravo/Fermer + dismiss/react mutations, auto-hold then dismiss.
   *  'history': replayed from the Historique sheet — pure rediffusion, no mutations, tap-anywhere to close. */
  mode: 'live' | 'history';
  onClose: () => void;
}

const HOLD_MS = 2300;

// Full-screen "secret rare unlock" reveal for a friend's chase-tier pull —
// same visual family as CaptureEffect's own capture celebration (via the
// shared RarityBurstCard), but crediting the friend instead of "you".
export function FriendCardReveal({ item, mode, onClose }: Props) {
  const { animationsEnabled } = useMotion();
  const t = useT();
  const dismiss = useDismissFriendNews();
  const react = useReactToFriendNews();
  const appear = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // 'live': every dismiss path (backdrop tap, auto-hold timeout, "Fermer") marks
  // the news read, same as the old FriendNewsPopup's close(). 'history' is a pure
  // rediffusion of an already-dismissed item — nothing to mark, just animate out.
  const close = () => {
    if (mode === 'live' && item) dismiss.mutate(item.id);
    if (!animationsEnabled) {
      appear.setValue(0);
      onCloseRef.current();
      return;
    }
    Animated.timing(appear, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => onCloseRef.current());
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!item) return;

    if (!animationsEnabled) {
      // Same reduced-motion contract as CaptureEffect: skip the spring entrance
      // and particle burst entirely, not just snap them — the burst itself is
      // the motion being opted out of. Chime/haptic still fire.
      appear.setValue(1);
      sparkle.setValue(0);
    } else {
      appear.setValue(0);
      sparkle.setValue(0);
      Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
      Animated.timing(sparkle, { toValue: 1, duration: 900, delay: 100, useNativeDriver: true }).start();
    }

    playChime('chase');
    hapticRevealSuccess();

    if (mode === 'live') {
      const timer = setTimeout(() => closeRef.current(), HOLD_MS);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, animationsEnabled, mode]);

  if (!item) return null;

  const onBravo = () => {
    react.mutate({ newsId: item.id, emoji: BRAVO_EMOJI });
    close();
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: appear.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }) }]} />
      <Pressable style={styles.center} onPress={close}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.authorName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.burstWrap}>
          <RarityBurstCard imageUri={item.imageLarge ?? item.imageSmall} accent={CHASE_GOLD} appear={appear} sparkle={sparkle} particleScale={1.7} />
        </View>
        <Animated.Text style={[styles.title, { opacity: appear }]}>{t('capture.rarityTitle', { rarityLabel: item.rarityLabel })}</Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: appear }]}>{t('friendReveal.unlockedSubtitle', { name: item.authorName })}</Animated.Text>
        {!!item.setName && (
          <Animated.Text style={[styles.caption, { opacity: appear }]}>{t('friendReveal.caption', { cardNumber: item.cardNumber, setName: item.setName })}</Animated.Text>
        )}
        {mode === 'live' && (
          <Animated.View style={[styles.actions, { opacity: appear }]}>
            <Pressable onPress={(e) => { e.stopPropagation(); onBravo(); }} style={styles.bravoBtn} hitSlop={4}>
              <Text style={styles.bravoEmoji}>{BRAVO_EMOJI}</Text>
              <Text style={styles.bravoText}>{t('friendReveal.bravo')}</Text>
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); close(); }} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>{t('badgeDetail.close')}</Text>
            </Pressable>
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
}

// Text colors below are fixed (not theme-driven) — this overlay always sits
// over its own dark scrim regardless of the app's light/dark theme, same as
// CaptureEffect.
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  center: { alignItems: 'center', paddingHorizontal: 32 },
  burstWrap: { width: 220, height: 264, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: CHASE_GOLD + '33',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 17, fontFamily: fonts.display, color: CHASE_GOLD },
  title: { fontSize: 19, fontFamily: fonts.display, color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: '#e5e5e5', textAlign: 'center', maxWidth: 260 },
  caption: { fontSize: 12, fontFamily: fonts.mono, color: '#c9c9c9', textAlign: 'center', marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  bravoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CHASE_GOLD, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  bravoEmoji: { fontSize: 18 },
  bravoText: { fontSize: 14, fontFamily: fonts.bodyBold, color: '#3b2a06' },
  closeBtn: { marginTop: spacing.md },
  closeText: { fontSize: 13, fontFamily: fonts.body, color: '#c9c9c9' },
});
