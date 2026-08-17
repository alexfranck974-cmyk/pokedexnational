import { View, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  /** Grey-out variant — used for "not owned yet" indicators (e.g. binder slots). */
  muted?: boolean;
}

export function Pokeball({ size = 20, muted = false }: Props) {
  const s = size;
  const line = Math.max(1, Math.round(s / 16));
  const inner = Math.round(s * 0.34);
  const dot = Math.round(inner * 0.5);
  const topColor = muted ? '#9ca3af' : '#ef4444';
  return (
    <View style={[styles.wrap, { width: s, height: s, borderRadius: s / 2, borderWidth: line }]}>
      <View style={[styles.top, { height: s / 2, backgroundColor: topColor }]} />
      <View style={[styles.bottom, { height: s / 2 }]} />
      <View style={[styles.equator, { top: s / 2 - line / 2, height: line }]} />
      <View style={[styles.center, {
        width: inner, height: inner, borderRadius: inner / 2,
        top: s / 2 - inner / 2, left: s / 2 - inner / 2,
        borderWidth: line,
      }]}>
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: 'white' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderColor: '#0f172a', backgroundColor: 'white', position: 'relative', overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white' },
  equator: { position: 'absolute', left: 0, right: 0, backgroundColor: '#0f172a' },
  center: { position: 'absolute', backgroundColor: 'white', borderColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
});
