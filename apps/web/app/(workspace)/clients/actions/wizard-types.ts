import { z } from 'zod';
import type { Client, Retainer, ActionResult } from '@flow/types';

export type WizardStep = 1 | 2 | 3 | 4;

export interface ContactData {
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
}

export interface BillingData {
  billing_email?: string;
  hourly_rate_cents?: number | null;
  address?: string;
  notes?: string;
}

const dateStr = z.string().refine(
  (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z')),
  'Invalid date format (YYYY-MM-DD)',
);

export const wizardRetainerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hourly_rate'),
    hourlyRateCents: z.number().int().min(1, 'Hourly rate must be positive'),
    billingPeriodDays: z.number().int().min(1).max(365).optional().default(30),
    startDate: dateStr.optional(),
    endDate: dateStr.nullable().optional(),
    notes: z.string().max(5000).optional().or(z.literal('')),
  }),
  z.object({
    type: z.literal('flat_monthly'),
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

export type RetainerFormData = z.infer<typeof wizardRetainerSchema>;

export interface WizardState {
  step: WizardStep;
  contactData: ContactData;
  billingData: BillingData;
  retainerData: RetainerFormData | null;
  retainerSkipped: boolean;
}

export interface WizardResult {
  client: Client;
  retainer?: Retainer;
  warning?: {
    code: 'RETAINER_SETUP_FAILED' | 'RETAINER_ACTIVE_EXISTS';
    message: string;
  };
}

export type WizardActionResult = ActionResult<WizardResult>;
