export const states = {
  dark: {
    hoverBrightness: '1.15',
    activeBrightness: '0.9',
  },
  light: {
    hoverBrightness: '0.95',
    activeBrightness: '1.05',
  },
  disabledOpacity: '0.4',
  readonlyOpacity: '0.7',
  overlayHoverDark: 'rgba(255,255,255,0.08)',
  overlayHoverLight: 'rgba(0,0,0,0.04)',
} as const;

export type States = typeof states;
