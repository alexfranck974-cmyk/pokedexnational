import { Platform } from 'react-native';

export type ChimeKind = 'type' | 'holo' | 'chase' | 'dex' | 'binderComplete';

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

function tone(context: AudioContext, freq: number, startTime: number, duration: number, peakGain: number, type: OscillatorType = 'sine') {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// A short rising 4-note run into a held, harmonized top note — evokes the
// classic "gotcha!" capture fanfare from the games without transcribing its
// actual copyrighted melody. Reused across all three tiers, just trimmed or
// embellished to match how big a deal the capture is.
function captureFanfare(context: AudioContext, now: number, scale: number, richness: number) {
  const step = 0.085 * scale;
  tone(context, 659.25, now, step * 1.1, 0.06 * richness);            // E5
  tone(context, 783.99, now + step, step * 1.1, 0.06 * richness);     // G5
  tone(context, 1046.5, now + step * 2, step * 1.1, 0.07 * richness); // C6
  const holdStart = now + step * 3;
  const holdDuration = 0.4 * scale;
  tone(context, 1318.5, holdStart, holdDuration, 0.09 * richness);       // E6 — held finish
  tone(context, 1975.5, holdStart, holdDuration, 0.035 * richness, 'triangle'); // B6 harmony sparkle
  return holdStart + holdDuration;
}

export function playChime(kind: ChimeKind) {
  const context = getContext();
  if (!context) return;
  const now = context.currentTime;
  if (kind === 'holo') {
    // An abbreviated two-note taste of the fanfare — enough to read as
    // "captured" without being loud on a fairly common tier.
    tone(context, 783.99, now, 0.12, 0.05);        // G5
    tone(context, 1046.5, now + 0.08, 0.22, 0.06); // C6
  } else if (kind === 'dex') {
    // Full fanfare shape, slightly softer/faster than 'type' — a new National
    // Dex entry is a real moment but shouldn't out-shout a type-completion.
    captureFanfare(context, now, 0.9, 0.85);
  } else if (kind === 'type') {
    captureFanfare(context, now, 1, 1);
  } else if (kind === 'binderComplete') {
    // Biggest moment in the app — finishing a whole binder — so the chase
    // fanfare tail gets a third, higher flourish note on top instead of two.
    const fanfareEnd = captureFanfare(context, now, 1.1, 1.3);
    tone(context, 1567.98, fanfareEnd - 0.05, 0.20, 0.05, 'triangle');
    tone(context, 2093.0, fanfareEnd + 0.05, 0.24, 0.05, 'triangle');
    tone(context, 2637.02, fanfareEnd + 0.15, 0.30, 0.05, 'triangle');
  } else {
    // Chase-tier: the full fanfare plus a sparkly flourish tail on top.
    const fanfareEnd = captureFanfare(context, now, 1.05, 1.2);
    tone(context, 1567.98, fanfareEnd - 0.05, 0.20, 0.05, 'triangle');
    tone(context, 2093.0, fanfareEnd + 0.05, 0.28, 0.05, 'triangle');
  }
}
