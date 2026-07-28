import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PokemonType } from '@/lib/types';
import { TYPE_COLORS, TYPE_LABEL_FR } from '@/lib/types-colors';
import { TypeIcon } from './TypeIcon';
import { playChime } from '@/lib/chime';
import { fonts } from '@/lib/theme';

export type CaptureEvent =
  | { id: string; kind: 'type'; type: PokemonType }
  | { id: string; kind: 'rarity'; tier: 'holo' | 'chase'; rarityLabel: string };

interface Props {
  event: CaptureEvent | null;
  onDone: () => void;
}

const PARTICLE_COUNT = 12;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (i / PARTICLE_COUNT) * Math.PI * 2,
  distance: 54 + (i % 3) * 16,
}));

const GOLD = '#fbbf24';

export function CaptureEffect({ event, onDone }: Props) {
  const appear = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!event) return;
    appear.setValue(0);
    sparkle.setValue(0);
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();

    const showBurst = event.kind === 'type' || (event.kind === 'rarity' && event.tier === 'chase');
    if (showBurst) Animated.timing(sparkle, { toValue: 1, duration: 900, delay: 100, useNativeDriver: true }).start();

    playChime(event.kind === 'type' ? 'type' : event.tier);

    const holdMs = event.kind === 'rarity' && event.tier === 'holo' ? 1300 : 2300;
    const timer = setTimeout(() => {
      Animated.timing(appear, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => onDoneRef.current());
    }, holdMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  if (!event) return null;

  const dismiss = () => {
    Animated.timing(appear, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDoneRef.current());
  };

  if (event.kind === 'rarity' && event.tier === 'holo') {
    return (
      <View style={styles.bannerWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.banner,
            {
              opacity: appear,
              transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
            },
          ]}>
          <Ionicons name="sparkles" size={16} color={GOLD} />
          <Text numberOfLines={1} style={styles.bannerText}>Carte {event.rarityLabel} capturée</Text>
        </Animated.View>
      </View>
    );
  }

  const isType = event.kind === 'type';
  const accent = isType ? TYPE_COLORS[event.type] : GOLD;
  const title = isType ? `Type ${TYPE_LABEL_FR[event.type]} complet !` : `✨ ${event.rarityLabel} !`;
  const subtitle = isType
    ? `Tous les Pokémon de type ${TYPE_LABEL_FR[event.type]} sont capturés dans ce set`
    : 'Une pépite pour ta collection';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: appear.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}
      />
      <Pressable style={styles.center} onPress={dismiss}>
        <View style={styles.burstWrap}>
          {PARTICLES.map((p, i) => {
            const tx = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.distance] });
            const ty = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.distance] });
            const op = sparkle.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
            const sc = sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1, 0.6] });
            return (
              <Animated.View key={i} style={[styles.particle, { opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }]}>
                <Ionicons name="sparkles" size={14} color={i % 2 === 0 ? accent : '#fff8e1'} />
              </Animated.View>
            );
          })}
          <Animated.View
            style={[
              styles.badge,
              { backgroundColor: accent + '22', borderColor: accent },
              { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
            ]}>
            {isType ? <TypeIcon type={event.type} size={72} /> : <Ionicons name="star" size={56} color={accent} />}
          </Animated.View>
        </View>
        <Animated.Text style={[styles.title, { opacity: appear }]}>{title}</Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: appear }]}>{subtitle}</Animated.Text>
      </Pressable>
    </View>
  );
}

// Text colors below are fixed (not theme-driven) — this overlay always sits
// over its own dark scrim regardless of the app's light/dark theme.
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  center: { alignItems: 'center', paddingHorizontal: 32 },
  burstWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  badge: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute' },
  title: { fontSize: 19, fontFamily: fonts.display, color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: '#e5e5e5', textAlign: 'center', maxWidth: 260 },
  bannerWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 54, zIndex: 1000 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1f1f1fee',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  bannerText: { color: 'white', fontSize: 13, fontFamily: fonts.bodyBold },
});
