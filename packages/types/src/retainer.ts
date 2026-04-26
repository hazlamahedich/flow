import { z } from 'zod';

const dateStr = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z')), 'Invalid date format (YYYY-MM-DD)');

export const retainerTypeEnum = z.enum(['hourly_rate', 'flat_monthly', 'package_based']);
export type RetainerType = z.infer<typeof retainerTypeEnum>;

export const createRetainerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hourly_rate'),
    clientId: z.string().uuid(),
    hourlyRateCents: z.number().int().min(1, 'Hourly rate must be positive'),
    billingPeriodDays: z.number().int().min(1).max(365).optional().default(30),
    startDate: dateStr.optional(),
    endDate: dateStr.nullable().optional(),
    notes: z.string().max(5000).optional().or(z.literal('')),
  }),
  z.object({
    type: z.literal('flat_monthly'),
    clientId: z.string().uuid(),
    monthlyFeeCents: z.number().int().min(1, 'Monthly fee must be positive'),
    monthlyHoursThreshold: z.string().refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0 && parseFloat(v) <= 99999999.99,
      'Hours threshold must be a positive number (max 99,999,999.99)',
    ),
    billingPeriodDays: z.number().int().min(1).max(365).optional().default(30),
    startDate: dateStr.optional(),
    endDate: dateStr.nullable().optional(),
    notes: z.string().max(5000).optional().or(z.literal('')),
  }),
  z.object({
    type: z.literal('package_based'),
    clientId: z.string().uuid(),
    packageHours: z.string().refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0 && parseFloat(v) <= 99999999.99,
      'Package hours must be a positive number (max 99,999,999.99)',
    ),
    packageName: z.string().trim().min(1, 'Package name is required').max(200),
    hourlyRateCents: z.number().int().min(1).optional(),
    billingPeriodDays: z.number().int().min(1).max(365).optional().default(30),
    startDate: dateStr.optional(),
    endDate: dateStr.nullable().optional(),
    notes: z.string().max(5000).optional().or(z.literal('')),
  }),
]);
export type CreateRetainerInput = z.infer<typeof createRetainerSchema>;

const hoursThresholdRefine = z.string().refine(
  (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0 && parseFloat(v) <= 99999999.99,
  'Must be a positive number (max 99,999,999.99)',
);

export const updateRetainerSchema = z.object({
  retainerId: z.string().uuid(),
  hourlyRateCents: z.number().int().min(1).nullable().optional(),
  monthlyFeeCents: z.number().int().min(1).nullable().optional(),
  monthlyHoursThreshold: hoursThresholdRefine.nullable().optional(),
  packageHours: hoursThresholdRefine.nullable().optional(),
  packageName: z.string().max(200).nullable().optional(),
  billingPeriodDays: z.number().int().min(1).max(365).optional(),
  notes: z.string().max(5000).nullable().optional().or(z.literal('')),
  endDate: dateStr.nullable().optional(),
}).refine(
  (data) => {
    const hasHourly = data.hourlyRateCents !== undefined;
    const hasMonthly = data.monthlyFeeCents !== undefined || data.monthlyHoursThreshold !== undefined;
    const hasPackage = data.packageHours !== undefined || data.packageName !== undefined;
    const typeFields = [hasHourly, hasMonthly, hasPackage].filter(Boolean).length;
    return typeFields <= 1;
  },
  { message: 'Cannot mix fields from different retainer types in a single update' },
);
export type UpdateRetainerInput = z.infer<typeof updateRetainerSchema>;

export const cancelRetainerSchema = z.object({
  retainerId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type CancelRetainerInput = z.infer<typeof cancelRetainerSchema>;

export const retainerSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  type: retainerTypeEnum,
  hourlyRateCents: z.number().nullable(),
  monthlyFeeCents: z.number().nullable(),
  monthlyHoursThreshold: z.string().nullable(),
  packageHours: z.string().nullable(),
  packageName: z.string().nullable(),
  billingPeriodDays: z.number(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  status: z.enum(['active', 'cancelled', 'expired']),
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Retainer = z.infer<typeof retainerSchema>;

export const scopeCreepAlertSchema = z.object({
  retainerId: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  retainerType: retainerTypeEnum,
  trackedMinutes: z.number(),
  thresholdMinutes: z.number(),
  utilizationPercent: z.number(),
});
export type ScopeCreepAlert = z.infer<typeof scopeCreepAlertSchema>;

export const utilizationStateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('trackable'),
    percent: z.number(),
    label: z.string(),
    color: z.enum(['green', 'amber', 'red']),
  }),
  z.object({
    type: z.literal('informational'),
    hoursTracked: z.number(),
  }),
  z.object({
    type: z.literal('no_threshold'),
    message: z.string(),
  }),
]);
export type UtilizationState = z.infer<typeof utilizationStateSchema>;
