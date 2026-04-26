export const REVIEW_ITEMS_MIN = 5;
export const REVIEW_ITEMS_MAX = 10;
export const REVIEW_ITEMS_DEFAULT = 7;
export const SNOOZE_DAYS = 7;
export const MAX_DEFERRALS = 3;
export const AUTO_REVIEW_INTERVAL_DAYS = 30;
export const AUTO_ACTION_LOOKBACK_DAYS = 7;
export const AUTO_DISMISS_MS = 20_000;

const MS_PER_DAY = 86_400_000;

export interface TrustAuditRecord {
  lastReviewedAt: string | null;
  createdAt: string;
  deferredCount: number;
  lastDeferredAt: string | null;
}

export function shouldTriggerCheckIn(
  currentLevel: string,
  auditRecord: TrustAuditRecord | null,
  optInEnabled: boolean,
  now: Date = new Date(),
): boolean {
  if (currentLevel !== 'auto') return false;
  if (!optInEnabled) return false;

  if (!auditRecord) return true;

  const referenceDateStr = auditRecord.lastReviewedAt ?? auditRecord.createdAt;
  const referenceDate = new Date(referenceDateStr);
  const daysSinceReview = (now.getTime() - referenceDate.getTime()) / MS_PER_DAY;

  if (daysSinceReview < AUTO_REVIEW_INTERVAL_DAYS) return false;

  if (auditRecord.deferredCount >= MAX_DEFERRALS) {
    if (auditRecord.lastDeferredAt) {
      const daysSinceDefer = (now.getTime() - new Date(auditRecord.lastDeferredAt).getTime()) / MS_PER_DAY;
      return daysSinceDefer >= SNOOZE_DAYS;
    }
    return true;
  }

  if (auditRecord.lastDeferredAt) {
    const daysSinceDefer = (now.getTime() - new Date(auditRecord.lastDeferredAt).getTime()) / MS_PER_DAY;
    return daysSinceDefer >= SNOOZE_DAYS;
  }

  return true;
}

export function scheduleNextCheckIn(
  auditRecord: TrustAuditRecord | null,
  workspaceTimezone: string,
): Date {
  const now = new Date();

  const toWorkspaceDate = (ms: number): Date => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: workspaceTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(new Date(ms));
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
      return new Date(
        Date.UTC(
          parseInt(get('year')),
          parseInt(get('month')) - 1,
          parseInt(get('day')),
          parseInt(get('hour')),
          parseInt(get('minute')),
          parseInt(get('second')),
        ),
      );
    } catch {
      return new Date(ms);
    }
  };

  if (!auditRecord) {
    return toWorkspaceDate(now.getTime() + AUTO_REVIEW_INTERVAL_DAYS * MS_PER_DAY);
  }

  if (auditRecord.lastDeferredAt) {
    return toWorkspaceDate(
      new Date(auditRecord.lastDeferredAt).getTime() + SNOOZE_DAYS * MS_PER_DAY,
    );
  }

  const referenceDateStr = auditRecord.lastReviewedAt ?? auditRecord.createdAt;
  const referenceDate = new Date(referenceDateStr);
  return toWorkspaceDate(referenceDate.getTime() + AUTO_REVIEW_INTERVAL_DAYS * MS_PER_DAY);
}

export function isMaxDeferralsReached(deferredCount: number): boolean {
  return deferredCount >= MAX_DEFERRALS;
}
