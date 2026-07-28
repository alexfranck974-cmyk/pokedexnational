import { Platform } from 'react-native';

export type ChimeKind = 'type' | 'holo' | 'chase';

// Synthesized in-browser via the Web Audio API — no audio asset to source/ship,
// and it keeps the effect purely web-only like other web-enhancement patterns in
// this codebase (native has no equivalent build set up yet).
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedContext) sharedContext = new AudioCtx();
  if (sharedContext.state === 'suspended') sharedContext.resume().catch(() => {});
  return sharedContext;
}

function tone(context: AudioContext, freq: number, startTime: number, duration: number, peakGain: number) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function playChime(kind: ChimeKind) {
  const context = getContext();
  if (!context) return;
  const now = context.currentTime;
  if (kind === 'holo') {
    // A single soft shimmer — deliberately understated so a fairly common tier
    // doesn't feel spammy on every pull.
    tone(context, 1318.5, now, 0.18, 0.05); // E6
  } else if (kind === 'type') {
    // Gentle ascending triad for completing a type line.
    tone(context, 523.25, now, 0.22, 0.06);        // C5
    tone(context, 659.25, now + 0.09, 0.22, 0.06); // E5
    tone(context, 783.99, now + 0.18, 0.30, 0.07); // G5
  } else {
    // Brighter 5-note "star" arpeggio for a chase-tier pull.
    tone(context, 659.25, now, 0.16, 0.06);        // E5
    tone(context, 830.61, now + 0.07, 0.16, 0.06); // Ab5
    tone(context, 987.77, now + 0.14, 0.16, 0.07); // B5
    tone(context, 1318.5, now + 0.21, 0.22, 0.08); // E6
    tone(context, 1568.0, now + 0.30, 0.35, 0.07); // G6 sparkle finish
  }
}
