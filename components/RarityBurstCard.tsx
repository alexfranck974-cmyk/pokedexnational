import { Animated, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  imageUri: string;
  accent: string;
  appear: Animated.Value;
  sparkle: Animated.Value;
  /** Wider particle radius for the bigger card zoom vs. the circular type badge. */
  particleScale?: number;
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

// Particle burst + gold glow + zoomed card image — the "secret rare unlock"
// visual shared by CaptureEffect's chase-tier moment and FriendCardReveal.
// Purely presentational: the parent owns and drives `appear`/`sparkle`.
export function RarityBurstCard({ imageUri, accent, appear, sparkle, particleScale = 1.7 }: Props) {
  return (
    <>
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
      <Animated.View
        style={[
          styles.cardGlow,
          { shadowColor: accent, backgroundColor: accent + '26' },
          { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
        ]}>
        <Image source={{ uri: imageUri }} style={styles.cardZoomImg} resizeMode="contain" />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  cardGlow: {
    width: CARD_ZOOM_WIDTH + 24, height: CARD_ZOOM_HEIGHT + 24, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 20,
  },
  cardZoomImg: { width: CARD_ZOOM_WIDTH, height: CARD_ZOOM_HEIGHT },
  particle: { position: 'absolute' },
});
