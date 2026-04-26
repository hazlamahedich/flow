import { z } from 'zod';
import type { Retainer } from '@flow/types';

export const retainerRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  client_id: z.string(),
  type: z.enum(['hourly_rate', 'flat_monthly', 'package_based']),
  hourly_rate_cents: z.number().nullable(),
  monthly_fee_cents: z.number().nullable(),
  monthly_hours_threshold: z.string().nullable(),
  package_hours: z.string().nullable(),
  package_name: z.string().nullable(),
  billing_period_days: z.number(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  status: z.enum(['active', 'cancelled', 'expired']),
  cancelled_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function mapRetainerRow(raw: Record<string, unknown>): Retainer {
  const row = retainerRowSchema.parse(raw);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    type: row.type,
    hourlyRateCents: row.hourly_rate_cents,
    monthlyFeeCents: row.monthly_fee_cents,
    monthlyHoursThreshold: row.monthly_hours_threshold,
    packageHours: row.package_hours,
    packageName: row.package_name,
    billingPeriodDays: row.billing_period_days,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
