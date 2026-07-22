import { View, StyleSheet } from 'react-native';

interface Props { size?: number; color?: string }

export function PokedexDeviceIcon({ size = 20, color = '#ef4444' }: Props) {
  const s = size;
  const line = Math.max(1, Math.round(s / 16));
  const lensOuter = Math.round(s * 0.52);
  const lensInner = Math.round(lensOuter * 0.58);
  const screenW = Math.round(s * 0.4);
  const screenH = Math.round(s * 0.22);
  return (
    <View style={[styles.body, {
      width: s, height: s, borderRadius: Math.round(s * 0.22), borderWidth: line, backgroundColor: color,
    }]}>
      <View style={[styles.lensOuter, {
        width: lensOuter, height: lensOuter, borderRadius: lensOuter / 2,
        top: Math.round(s * 0.08), left: Math.round(s * 0.08), borderWidth: line,
      }]}>
        <View style={[styles.lensInner, { width: lensInner, height: lensInner, borderRadius: lensInner / 2, borderWidth: line }]} />
      </View>
      <View style={[styles.screen, {
        width: screenW, height: screenH, borderRadius: Math.round(s * 0.06),
        bottom: Math.round(s * 0.1), right: Math.round(s * 0.1),
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { position: 'relative', overflow: 'hidden', borderColor: '#0f172a' },
  lensOuter: { position: 'absolute', backgroundColor: 'white', borderColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  lensInner: { backgroundColor: '#60a5fa', borderColor: '#0f172a' },
  screen: { position: 'absolute', backgroundColor: '#0f172a' },
});
