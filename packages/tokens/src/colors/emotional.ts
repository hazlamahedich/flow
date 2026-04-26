export const emotionalTokens = {
  '--flow-emotion-tension': '#f59e0b',
  '--flow-emotion-calm': '#22c55e',
  '--flow-emotion-pride': '#6366f1',
  '--flow-emotion-trust-building': '#3b82f6',
  '--flow-emotion-trust-established': '#22c55e',
  '--flow-emotion-trust-confirm': 'hsl(263, 85%, 75%)',
  '--flow-emotion-trust-auto': '#16a34a',
  '--flow-emotion-trust-betrayed': '#ef4444',
} as const;

export type EmotionalTokens = typeof emotionalTokens;
