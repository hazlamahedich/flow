export interface BillingPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export function getCurrentBillingPeriod(
  startDate: Date,
  billingPeriodDays: number,
  referenceDate: Date,
): BillingPeriod {
  const startMs = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const refMs = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());

  const elapsedDays = Math.max(0, refMs - startMs) / (1000 * 60 * 60 * 24);
  const periodsElapsed = Math.max(0, Math.floor(elapsedDays / billingPeriodDays));

  const periodStartMs = startMs + periodsElapsed * billingPeriodDays * (1000 * 60 * 60 * 24);
  const periodEndMs = periodStartMs + billingPeriodDays * (1000 * 60 * 60 * 24);

  return {
    periodStart: new Date(periodStartMs),
    periodEnd: new Date(periodEndMs),
  };
}
