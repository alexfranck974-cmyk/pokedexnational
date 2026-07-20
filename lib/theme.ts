export const colors = {
  bg: '#f7f8fb',
  surface: '#ffffff',
  surfaceAlt: '#eef1f6',
  border: '#e4e8ef',
  borderStrong: '#cfd6e0',

  text: '#0f172a',
  textMuted: '#556274',
  textDim: '#94a3b8',

  primary: '#6366f1',
  primaryDark: '#4f46e5',
  primaryBg: '#eef2ff',

  success: '#10b981',
  successBg: '#ecfdf5',

  danger: '#ef4444',
  dangerBg: '#fef2f2',

  warning: '#f59e0b',
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
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
