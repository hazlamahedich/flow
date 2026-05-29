import type { OverallHealth, HealthIndicators } from './schemas';

export interface HealthInput {
  timeEntryHoursLast30d: number;
  emailExchangeCount: number;
  meetingCount: number;
  overdueInvoiceCount: number;
  daysSinceLastPayment: number;
  avgResponseTimeHours: number;
  meetingBypassCount: number;
  daysSinceLastContact: number;
  unpaidInvoiceCount: number;
  timeEntryStreakDays: number;
  lastInvoicePaidAt: string | null;
  clientCreatedAt: string;
}

export function computeEngagementScore(input: HealthInput): number {
  const timeComponent = (input.timeEntryHoursLast30d / 10) * 20;
  const emailComponent = (input.emailExchangeCount / 5) * 20;
  const meetingComponent = (input.meetingCount / 2) * 20;
  const baseline = 20;
  return Math.min(100, Math.round(baseline + timeComponent + emailComponent + meetingComponent));
}

export function computePaymentScore(input: HealthInput): number {
  if (input.overdueInvoiceCount === 0 && input.daysSinceLastPayment === 0) {
    return 100;
  }
  const overduePenalty = input.overdueInvoiceCount * 15;
  const timePenalty = Math.round((input.daysSinceLastPayment / 7) * 5);
  return Math.max(0, Math.min(100, 100 - overduePenalty - timePenalty));
}

export function computeCommunicationScore(input: HealthInput): number {
  const responsePenalty = Math.round(input.avgResponseTimeHours * 2);
  const bypassPenalty = input.meetingBypassCount * 10;
  return Math.max(0, Math.min(100, 100 - responsePenalty - bypassPenalty));
}

export function computeOverallHealth(
  engagement: number,
  payment: number,
  communication: number,
  input: HealthInput,
  referenceDate?: Date,
): OverallHealth {
  const createdDate = new Date(input.clientCreatedAt);
  const now = referenceDate ?? new Date();
  const daysSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 14) {
    return 'onboarding';
  }
  if (engagement < 30 || communication < 30 || payment < 40) {
    return 'critical';
  }
  if (engagement < 50 || communication < 50 || (payment < 60 && communication < 60)) {
    return 'at-risk';
  }
  if (engagement >= 60 && payment >= 60 && communication >= 60) {
    return 'healthy';
  }
  return 'neutral';
}

export function computeIndicators(input: HealthInput): HealthIndicators {
  return {
    days_since_last_contact: input.daysSinceLastContact,
    unpaid_invoice_count: input.unpaidInvoiceCount,
    time_entry_streak_days: input.timeEntryStreakDays,
    avg_response_time_hours: input.avgResponseTimeHours,
    meeting_bypass_count: input.meetingBypassCount,
    last_invoice_paid_at: input.lastInvoicePaidAt,
  };
}
