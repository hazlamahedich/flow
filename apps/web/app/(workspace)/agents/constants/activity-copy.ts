export const EMPTY_STATE_NEVER = 'Your agents haven\'t taken any actions yet. They will appear here as they start working for you.';
export const EMPTY_STATE_FILTERED = 'No actions match your filters. Try adjusting the date range or agent filter.';
export const EMPTY_STATE_ERROR = 'We couldn\'t load your timeline. Your actions are safe — we\'ll try again.';

export const ERROR_TONE = {
  header: 'Hmm, that didn\'t work as expected',
  cta: 'Try again',
} as const;

export const FEEDBACK_PROMPTS = {
  positive: 'Rate this action: Positive',
  negative: 'Rate this action: Negative',
  notePlaceholder: 'Add a note (optional)',
  recorded: 'Recorded.',
} as const;

export const CORRECTION_LABELS = {
  button: 'Issue correction',
  title: 'Correct agent output',
  submit: 'Send correction',
  toast: 'Correction sent — approval pending',
  depthExceeded: 'Maximum correction depth reached',
} as const;

export const INHALER_TEMPLATES = {
  summary: (completed: number, coordinated: number, attention: number) =>
    `Your agents completed ${completed} actions — ${coordinated} required coordination. ${attention} need your attention.`,
  filtered: (showing: number, total: number) =>
    `Showing ${showing} of ${total} actions.`,
} as const;

export const KEYBOARD_SHORTCUTS = {
  up: 'Navigate up',
  down: 'Navigate down',
  enter: 'Open detail',
  escape: 'Close detail',
  f: 'Toggle filters',
  g: 'Toggle grouped view',
} as const;

export const COORDINATION_LABELS = {
  agentCount: (n: number) => `${n}-agent coordination`,
  initiator: 'Initiated',
  expanded: 'Show details',
  collapsed: 'Collapse',
} as const;

export const TOAST_MESSAGES = {
  feedbackSubmitted: 'Feedback recorded',
  correctionSent: 'Correction sent — approval pending',
  correctionFailed: 'Could not send correction',
} as const;
