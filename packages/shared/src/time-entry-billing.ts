/**
 * Compute the billable amount for a time entry.
 *
 * Formula: amount_cents = ROUND(hourly_rate_cents * (duration_minutes / 60))
 * Uses standard half-up rounding (Math.round).
 *
 * @param durationMinutes - Duration in minutes (can be 0)
 * @param hourlyRateCents - Hourly rate in cents (must be > 0)
 * @returns Computed amount in cents
 */
export function computeTimeEntryAmount(
  durationMinutes: number,
  hourlyRateCents: number,
): number {
  if (durationMinutes < 0) {
    throw new RangeError('durationMinutes must be >= 0');
  }
  if (hourlyRateCents <= 0) {
    throw new RangeError('hourlyRateCents must be > 0');
  }
  const quantity = durationMinutes / 60;
  return Math.round(hourlyRateCents * quantity);
}

/**
 * Format a time entry line item description.
 * Shows notes + duration hint.
 */
export function formatTimeEntryDescription(notes: string | null | undefined, durationMinutes: number): string {
  const parts: string[] = [];
  if (notes) parts.push(notes);
  parts.push(`(${durationMinutes} min)`);
  return parts.join(' ');
}

/**
 * Format a time entry line item display amount.
 */
export function formatTimeEntryAmountDisplay(amountCents: number, durationMinutes: number): string {
  const dollars = (amountCents / 100).toFixed(2);
  return `$${dollars} (${durationMinutes} min)`;
}
