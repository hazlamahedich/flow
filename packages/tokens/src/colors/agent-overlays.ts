export const agentOverlays = {
  active: { opacity: 1.0 },
  idle: { opacity: 0.5 },
  thinking: {
    opacityMin: 0.5,
    opacityMax: 0.8,
    duration: '1.5s',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  error: {
    opacity: 0.3,
    ringColor: 'var(--flow-status-error)',
    ringWidth: '2px',
  },
  offline: {
    opacity: 0.15,
    filter: 'grayscale(100%)',
  },
} as const;

export type AgentOverlays = typeof agentOverlays;
