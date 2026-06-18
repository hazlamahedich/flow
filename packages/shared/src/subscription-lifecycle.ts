import type { SubscriptionStatus } from '@flow/types';

export type { SubscriptionStatus } from '@flow/types';

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  free: ['active'],
  active: ['past_due', 'suspended', 'cancelled'],
  past_due: ['suspended', 'active'],
  cancelled: ['suspended'],
  suspended: ['deleted', 'active'],
  deleted: [],
};

export function transitionSubscriptionStatus(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): { ok: true } | { ok: false; reason: string } {
  throw new Error('transitionSubscriptionStatus not implemented');
}

export function isTerminalStatus(status: SubscriptionStatus): status is 'deleted' {
  throw new Error('isTerminalStatus not implemented');
}

export function mapStripeStatusToDb(stripeStatus: string): SubscriptionStatus | null {
  throw new Error('mapStripeStatusToDb not implemented');
}

export const GRACE_PERIOD_DAYS = 7;
export const SUSPENSION_MAX_DAYS = 30;
