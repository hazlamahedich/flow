export const darkSemanticColors = {
  '--flow-bg-canvas': '#09090b',
  '--flow-bg-surface': '#18181b',
  '--flow-bg-surface-raised': '#27272a',
  '--flow-bg-surface-overlay': '#3f3f46',
  '--flow-text-primary': '#fafafa',
  '--flow-text-secondary': '#a1a1aa',
  '--flow-text-muted': '#71717a',
  '--flow-text-disabled': '#52525b',
  '--flow-text-inverse': '#09090b',
  '--flow-border-default': '#27272a',
  '--flow-border-subtle': '#18181b',
  '--flow-border-strong': '#3f3f46',
  '--flow-accent-primary': '#6366f1',
  '--flow-accent-primary-text': '#ffffff',
  '--flow-status-success': '#22c55e',
  '--flow-status-warning': '#f59e0b',
  '--flow-status-error': '#ef4444',
  '--flow-status-info': '#3b82f6',
} as const;

export type DarkSemanticColors = typeof darkSemanticColors;
