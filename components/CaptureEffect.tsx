import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TYPE_COLORS } from '@/lib/types-colors';
import { tcgTypeLabelFr, tcgTypeAsPokemonType } from '@/lib/tcg-types';
import { TypeIcon } from './TypeIcon';
import { playChime } from '@/lib/chime';
import { fonts } from '@/lib/theme';

export type CaptureEvent =
  // `type` is the TCG card's own printed energy type (e.g. "Water", "Colorless"),
  // not a video-game PokemonType — see lib/tcg-types.ts.
  | { id: string; kind: 'type'; type: string }
  | { id: string; kind: 'rarity'; tier: 'holo' | 'chase'; rarityLabel: string; imageSmall: string };

interface Props {
  event: CaptureEvent | null;
  onDone: () => void;
}

const PARTICLE_COUNT = 12;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (i / PARTICLE_COUNT) * Math.PI * 2,
  distance: 54 + (i % 3) * 16,
}));

// Same card proportions as CardZoomModal, so the auto-zoomed card here reads
// consistently with the rest of the app.
const CARD_RATIO = 0.72;
const CARD_ZOOM_WIDTH = 138;
const CARD_ZOOM_HEIGHT = CARD_ZOOM_WIDTH / CARD_RATIO;

const GOLD = '#fbbf24';
const NEUTRAL = '#9ca3af';

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
          <Image source={{ uri: event.imageSmall }} style={styles.bannerThumb} resizeMode="contain" />
          <Ionicons name="sparkles" size={16} color={GOLD} />
          <Text numberOfLines={1} style={styles.bannerText}>Carte {event.rarityLabel} capturée</Text>
        </Animated.View>
      </View>
    );
  }

  const isType = event.kind === 'type';
  const isChase = event.kind === 'rarity' && event.tier === 'chase';
  // "Colorless" has no video-game type equivalent — falls back to a neutral tint/icon.
  const pokemonType = isType ? tcgTypeAsPokemonType(event.type) : undefined;
  const accent = isType ? (pokemonType ? TYPE_COLORS[pokemonType] : NEUTRAL) : GOLD;
  const title = isType ? `Type ${tcgTypeLabelFr(event.type)} complet !` : `✨ ${event.rarityLabel} !`;
  const subtitle = isType
    ? `Tous les Pokémon de type ${tcgTypeLabelFr(event.type)} sont capturés dans ce set`
    : 'Une pépite pour ta collection';
  // The chase-tier card zoom is bigger than the circular type badge, so
  // particles need a wider radius to clear its edges instead of overlapping it.
  const particleScale = isChase ? 1.7 : 1;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: appear.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}
      />
      <Pressable style={styles.center} onPress={dismiss}>
        <View style={[styles.burstWrap, isChase && styles.burstWrapChase]}>
          {PARTICLES.map((p, i) => {
            const dist = p.distance * particleScale;
            const tx = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * dist] });
            const ty = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * dist] });
            const op = sparkle.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
            const sc = sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1, 0.6] });
            return (
              <Animated.View key={i} style={[styles.particle, { opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }]}>
                <Ionicons name="sparkles" size={14} color={i % 2 === 0 ? accent : '#fff8e1'} />
              </Animated.View>
            );
          })}
          {event.kind === 'rarity' ? (
            <Animated.View
              style={[
                styles.cardGlow,
                { shadowColor: accent, backgroundColor: accent + '26' },
                { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
              ]}>
              <Image source={{ uri: event.imageSmall }} style={styles.cardZoomImg} resizeMode="contain" />
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                styles.badge,
                { backgroundColor: accent + '22', borderColor: accent },
                { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
              ]}>
              {pokemonType ? <TypeIcon type={pokemonType} size={72} /> : <Ionicons name="ellipse" size={56} color={accent} />}
            </Animated.View>
          )}
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
  burstWrapChase: { width: 220, height: CARD_ZOOM_HEIGHT + 40 },
  badge: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cardGlow: {
    width: CARD_ZOOM_WIDTH + 24, height: CARD_ZOOM_HEIGHT + 24, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 20,
  },
  cardZoomImg: { width: CARD_ZOOM_WIDTH, height: CARD_ZOOM_HEIGHT },
  particle: { position: 'absolute' },
  title: { fontSize: 19, fontFamily: fonts.display, color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: '#e5e5e5', textAlign: 'center', maxWidth: 260 },
  bannerWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 54, zIndex: 1000 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1f1f1fee',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  bannerThumb: { width: 24, height: 24 / CARD_RATIO, borderRadius: 3 },
  bannerText: { color: 'white', fontSize: 13, fontFamily: fonts.bodyBold },
});
