import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BravoEvent } from '@/lib/bravo-notifications';
import { TypeIcon } from './TypeIcon';
import { TYPE_COLORS } from '@/lib/types-colors';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { useMotion } from '@/lib/motion';

interface Props {
  event: BravoEvent | null;
  onDone: () => void;
}

const HOLD_MS = 3000;
const NEUTRAL = '#9ca3af';

export function BravoNotificationBanner({ event, onDone }: Props) {
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
  const accent = event.pokemonType ? TYPE_COLORS[event.pokemonType] : NEUTRAL;

  const dismiss = () => {
    if (!animationsEnabled) { onDoneRef.current(); return; }
    Animated.timing(translateY, { toValue: -80, duration: 180, useNativeDriver: true }).start(() => onDoneRef.current());
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Pressable onPress={dismiss} style={styles.banner}>
          {event.pokemonType ? (
            <TypeIcon type={event.pokemonType} size={30} />
          ) : (
            <Ionicons name="happy" size={30} color={accent} />
          )}
          <Text style={styles.text}>
            <Text style={styles.textBold}>👏 Bravo</Text> reçu de <Text style={styles.textBold}>{event.reactorName}</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
