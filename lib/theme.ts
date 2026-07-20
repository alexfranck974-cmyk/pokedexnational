export const colors = {
  bg: '#0f172a',          // slate-900 — deepest
  surface: '#1e293b',     // slate-800 — cards, headers
  surfaceAlt: '#334155',  // slate-700 — chips inactive, subrows
  border: '#334155',      // slate-700
  borderStrong: '#475569',// slate-600

  text: '#f1f5f9',        // slate-100
  textMuted: '#cbd5e1',   // slate-300
  textDim: '#94a3b8',     // slate-400

  primary: '#818cf8',     // indigo-400 — lighter for dark bg
  primaryDark: '#6366f1', // indigo-500
  primaryBg: '#312e81',   // indigo-900

  success: '#34d399',     // emerald-400
  successBg: '#064e3b',   // emerald-900

  danger: '#f87171',      // red-400
  dangerBg: '#7f1d1d',    // red-900

  warning: '#fbbf24',     // amber-400

  overlay: 'rgba(15, 23, 42, 0.85)',      // dark surface bg for image badges
  backdrop: 'rgba(0, 0, 0, 0.7)',         // modal backdrop
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;
