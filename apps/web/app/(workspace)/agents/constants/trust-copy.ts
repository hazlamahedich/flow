/**
 * Trust notification copy — voice-and-tone guide
 *
 * Transparent with empathy. Honest without being cold. Behavioral, not emotional.
 *
 * Rules:
 * - Describe WHAT changed, not WHY we think it happened
 * - Name capabilities, not abstract "trust levels"
 * - Acknowledge impact ("tasks have been paused")
 * - Never: "Trust level decreased", "Agent failed", "Setting trust level back to Basic",
 *   "Agent Permissions Updated" (too sanitized)
 */

export const CEREMONY_COPY = {
  upgrade: {
    title: (agentLabel: string) => `${agentLabel} has earned your trust`,
    body: (agentLabel: string, actionLabel: string) =>
      `${agentLabel} has been handling ${actionLabel} consistently well. Let them handle it?`,
    stats: (clean: number, total: number, days: number) =>
      `${clean} clean approvals, ${total} total runs, ${days} days at this level`,
    accept: 'Accept',
    decline: 'Not yet',
    remindLater: 'Remind me later',
    escapeInstruction: 'Press Escape once to focus Decline, twice to dismiss',
  },
  downgrade: {
    title: (agentLabel: string) => `We've Adjusted ${agentLabel}'s Permissions`,
    summary: (agentLabel: string, capabilities: string[]) =>
      `${agentLabel} can no longer access: ${capabilities.join(', ')}. Tasks using these capabilities have been paused.`,
    reason: (trigger: string) => `Based on recent activity: ${trigger}`,
    undoLabel: 'Undo — Restore previous permissions',
    options: {
      keepAuto: 'Keep in Auto — one-off',
      moveToConfirmClient: 'Move to Confirm for this client',
      moveToConfirmAll: 'Move to Confirm for all clients',
    },
    acknowledge: 'I understand',
  },
} as const;

export const MILESTONE_COPY = {
  FIRST_10: {
    marker: '10 tasks, building trust',
    label: 'First 10',
  },
  FIFTY_CLEAN: {
    marker: '50 tasks, no stumbles',
    label: '50 Clean',
  },
  HUNDRED_CLEAN: {
    marker: '100 tasks, no stumbles',
    label: '100 Clean',
  },
  ZERO_REJECTIONS_WEEK: {
    marker: 'A perfect week',
    label: 'Perfect Week',
  },
} as const;

export type MilestoneType = keyof typeof MILESTONE_COPY;

export const AGENT_LABELS: Record<string, string> = {
  inbox: 'Inbox Agent',
  calendar: 'Calendar Agent',
  'ar-collection': 'AR Collection Agent',
  'weekly-report': 'Weekly Report Agent',
  'client-health': 'Client Health Agent',
  'time-integrity': 'Time Integrity Agent',
};

export const UNDO_COPY = {
  success: 'Trust level restored.',
  expired: 'Undo window has expired.',
  error: 'Could not undo. Please try again.',
} as const;

export const REGRESSION_ACKNOWLEDGED_COPY = 'Permission change acknowledged.' as const;

export const AUTO_DISMISS_TOAST_MS = 10_000;
export const AUTO_DISMISS_MILESTONE_MS = 8_000;
export const CEREMONY_BADGE_PULSE_MS = 500;
export const CELEBRATION_DURATION_MS = 300;

export const CHECKIN_COPY = {
  prompt: {
    title: (agentLabel: string) =>
      `It's been a while since you reviewed ${agentLabel}'s work. Want to take a look?`,
    accept: 'Take a look',
    defer: 'Remind me later',
    pinnedBadge: 'Review needed',
    pinnedToast: (agentLabel: string) =>
      `${agentLabel} is ready for a check-in`,
  },
  review: {
    title: (agentLabel: string) => `Recent ${agentLabel} actions`,
    accept: 'All good?',
    adjust: "Let's adjust",
    emptyTitle: 'No recent actions to review. All good!',
    adjustHref: (agentId: string) => `/agents?agent=${agentId}&tab=trust`,
  },
  history: {
    title: 'Trust History',
    empty: 'No trust events yet. Events will appear here when agent trust levels change.',
    allCaughtUp: 'All caught up! Your agents are reviewed and current.',
    columns: {
      agent: 'Agent',
      transition: 'Change',
      reason: 'Reason',
      date: 'Date',
    },
    filters: {
      agent: 'Agent',
      direction: 'Direction',
      directionAll: 'All',
      directionUpgrade: 'Upgrades',
      directionRegression: 'Adjustments',
      dateFrom: 'From',
      dateTo: 'To',
      apply: 'Apply',
      clear: 'Clear',
    },
    error: 'Could not load trust history. Please try again.',
    checkinDisabled: 'Check-in reminders are turned off.',
  },
} as const;
