import { createFlowError } from '@flow/db';
import { computeTimeEntryAmount, formatTimeEntryDescription } from '@flow/shared';
import type { CreateInvoiceInput } from '@flow/types';

export interface DbLineItem {
  source_type: string;
  retainer_id?: string;
  time_entry_id?: string;
  description: string;
  quantity: string;
  unit_price_cents: number;
  amount_cents: number;
  sort_order: number;
}

export interface LineItemsResult {
  dbLineItems: DbLineItem[];
  totalCents: number;
}

export function buildLineItemsAndTotal(
  lineItems: CreateInvoiceInput['lineItems'],
  timeEntriesMap: Map<string, { durationMinutes: number }>,
  hourlyRateCents: number | null,
): { success: true; data: LineItemsResult } | { success: false; error: ReturnType<typeof createFlowError> } {
  const dbLineItems: DbLineItem[] = [];
  let totalCents = 0;

  for (const [index, item] of lineItems.entries()) {
    if (item.sourceType === 'time_entry') {
      const te = timeEntriesMap.get(item.timeEntryId);
      if (!te) {
        return {
          success: false,
          error: createFlowError(400, 'VALIDATION_ERROR', `Time entry ${item.timeEntryId} not found.`, 'validation'),
        };
      }

      if (hourlyRateCents == null || hourlyRateCents <= 0) {
        return {
          success: false,
          error: createFlowError(400, 'NO_HOURLY_RATE', 'No hourly rate configured for this client. Set a retainer or client rate first.', 'validation'),
        };
      }

      const amountCents = computeTimeEntryAmount(te.durationMinutes, hourlyRateCents);
      const quantity = te.durationMinutes / 60;

      dbLineItems.push({
        source_type: 'time_entry',
        time_entry_id: item.timeEntryId,
        description: formatTimeEntryDescription(item.description, te.durationMinutes),
        quantity: quantity.toFixed(2),
        unit_price_cents: hourlyRateCents,
        amount_cents: amountCents,
        sort_order: index + 1,
      });
      totalCents += amountCents;
    } else if (item.sourceType === 'retainer') {
      const amount = item.amountCents;
      dbLineItems.push({
        source_type: 'retainer',
        retainer_id: item.retainerId,
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unit_price_cents: Math.round(amount / item.quantity),
        amount_cents: amount,
        sort_order: index + 1,
      });
      totalCents += amount;
    } else {
      const fixedAmount = item.amountCents;
      dbLineItems.push({
        source_type: 'fixed_service',
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unit_price_cents: Math.round(fixedAmount / item.quantity),
        amount_cents: fixedAmount,
        sort_order: index + 1,
      });
      totalCents += fixedAmount;
    }
  }

  return { success: true, data: { dbLineItems, totalCents } };
}
