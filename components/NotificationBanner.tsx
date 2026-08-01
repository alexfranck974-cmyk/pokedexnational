import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { AppNotification } from '@/lib/notifications';
import { TypeIcon } from './TypeIcon';
import { TradeIcon } from './TradeIcon';
import { IconBubble } from './IconBubble';
import { TYPE_COLORS } from '@/lib/types-colors';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useMotion } from '@/lib/motion';

interface Props {
  event: AppNotification | null;
  onDone: () => void;
}

const HOLD_MS = 3000;
const NEUTRAL = '#9ca3af';
const TRADE_TINT = '#2dd4bf';

export function NotificationBanner({ event, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { animationsEnabled } = useMotion();
  const translateY = useRef(new Animated.Value(-80)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const styles = useThemedStyles((colors, shadow) => ({
    wrap: { position: 'absolute' as const, top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, zIndex: 2000 },
    banner: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm,
      borderWidth: 1, borderColor: colors.border, ...shadow.md,
    },
    text: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
    textBold: { fontFamily: fonts.bodyBold },
  }));

  useEffect(() => {
    if (!event) return;
    if (!animationsEnabled) {
      translateY.setValue(0);
    } else {
      translateY.setValue(-80);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }).start();
    }
    const timer = setTimeout(() => {
      if (!animationsEnabled) { onDoneRef.current(); return; }
      Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }).start(() => onDoneRef.current());
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [event?.id, animationsEnabled, translateY]);

  if (!event) return null;

  const dismiss = () => {
    if (!animationsEnabled) { onDoneRef.current(); return; }
    Animated.timing(translateY, { toValue: -80, duration: 180, useNativeDriver: true }).start(() => onDoneRef.current());
  };

  const icon = event.kind === 'bravo' ? (
    event.pokemonType ? <TypeIcon type={event.pokemonType} size={30} /> : <Ionicons name="happy" size={30} color={NEUTRAL} />
  ) : (
    <IconBubble size={30} color={TRADE_TINT + '22'}>
      <TradeIcon size={15} color={TRADE_TINT} />
    </IconBubble>
  );

  const text = event.kind === 'bravo' ? (
    <><Text style={styles.textBold}>👏 Bravo</Text> reçu de <Text style={styles.textBold}>{event.counterpartyName}</Text></>
  ) : event.kind === 'trade_received' ? (
    <><Text style={styles.textBold}>{event.counterpartyName}</Text> te propose un échange</>
  ) : event.kind === 'trade_accepted' ? (
    <><Text style={styles.textBold}>{event.counterpartyName}</Text> a accepté ta proposition d’échange</>
  ) : (
    <>Échange avec <Text style={styles.textBold}>{event.counterpartyName}</Text> finalisé !</>
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Pressable onPress={dismiss} style={styles.banner}>
          {icon}
          <Text style={styles.text}>{text}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
