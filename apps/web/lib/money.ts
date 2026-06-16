/**
 * Client-side money formatting helpers.
 *
 * Cents are integers; avoid float math in display by using the shared
 * integer-aware formatter.
 */
import { formatCentsToDollar } from '@flow/shared';

/**
 * Format an integer cent amount as a decimal string.
 * Returns '$0.00' for invalid inputs to avoid NaN in the UI.
 */
export function formatCents(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return '0.00';
  const numeric = typeof cents === 'string' ? Number(cents) : cents;
  if (!Number.isFinite(numeric)) return '0.00';
  return formatCentsToDollar(numeric);
}
