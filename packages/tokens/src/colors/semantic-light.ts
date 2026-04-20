export const lightSemanticColors = {
  '--flow-bg-canvas': '#fafaf8',
  '--flow-bg-surface': '#f3f2ef',
  '--flow-bg-surface-raised': '#ffffff',
  '--flow-bg-surface-overlay': 'rgba(250,250,248,0.85)',
  '--flow-text-primary': '#1a1917',
  '--flow-text-secondary': '#6b6962',
  '--flow-text-muted': '#9c9a92',
  '--flow-text-disabled': '#c4c2ba',
  '--flow-text-inverse': '#fafaf8',
  '--flow-border-default': '#e8e6e1',
  '--flow-border-subtle': '#f0eee9',
  '--flow-border-strong': '#d1cfc8',
  '--flow-accent-primary': '#4f46e5',
  '--flow-accent-primary-text': '#ffffff',
  '--flow-status-success': '#16a34a',
  '--flow-status-warning': '#d97706',
  '--flow-status-error': '#dc2626',
  '--flow-status-info': '#2563eb',
} as const;

export type LightSemanticColors = typeof lightSemanticColors;
