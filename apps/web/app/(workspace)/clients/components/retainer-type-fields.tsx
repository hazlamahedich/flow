'use client';

import type { RetainerType } from '@flow/types';

export const TYPE_CARDS: { type: RetainerType; title: string; description: string }[] = [
  { type: 'hourly_rate', title: 'Hourly Rate', description: 'Bill by the hour at a fixed rate' },
  { type: 'flat_monthly', title: 'Flat Monthly', description: 'Fixed fee per billing period' },
  { type: 'package_based', title: 'Package', description: 'Set hours for a defined package' },
];

interface RetainerTypeFieldsProps {
  type: RetainerType | null;
  register: (name: string) => Record<string, unknown>;
  defaultValue?: Record<string, string | number | null>;
}

export function RetainerTypeFields({ type, register, defaultValue }: RetainerTypeFieldsProps) {
  if (!type) return null;

  return (
    <div className="space-y-3">
      {(type === 'hourly_rate') && (
        <label className="block text-sm">
          <span className="text-[var(--flow-color-text-secondary)]">Rate ($/hr)</span>
          <input
            {...register('hourlyRateCents')}
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValue?.hourlyRateCents ?? ''}
            className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
            required
          />
        </label>
      )}

      {(type === 'flat_monthly') && (
        <>
          <label className="block text-sm">
            <span className="text-[var(--flow-color-text-secondary)]">Monthly Fee ($)</span>
            <input
              {...register('monthlyFeeCents')}
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultValue?.monthlyFeeCents ?? ''}
              className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--flow-color-text-secondary)]">Hours Threshold</span>
            <input
              {...register('monthlyHoursThreshold')}
              type="text"
              defaultValue={defaultValue?.monthlyHoursThreshold ?? ''}
              placeholder="e.g., 30"
              className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              required
            />
          </label>
        </>
      )}

      {(type === 'package_based') && (
        <>
          <label className="block text-sm">
            <span className="text-[var(--flow-color-text-secondary)]">Package Name</span>
            <input
              {...register('packageName')}
              type="text"
              defaultValue={defaultValue?.packageName ?? ''}
              className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--flow-color-text-secondary)]">Package Hours</span>
            <input
              {...register('packageHours')}
              type="text"
              defaultValue={defaultValue?.packageHours ?? ''}
              placeholder="e.g., 40"
              className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--flow-color-text-secondary)]">Overage Rate ($/hr, optional)</span>
            <input
              {...register('hourlyRateCents')}
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultValue?.hourlyRateCents ?? ''}
              className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
            />
          </label>
        </>
      )}

      <label className="block text-sm">
        <span className="text-[var(--flow-color-text-secondary)]">Billing Period (days)</span>
        <input
          {...register('billingPeriodDays')}
          type="number"
          min="1"
          max="365"
          defaultValue={defaultValue?.billingPeriodDays ?? 30}
          className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--flow-color-text-secondary)]">End Date (optional)</span>
        <input
          {...register('endDate')}
          type="date"
          defaultValue={defaultValue?.endDate ?? ''}
          className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--flow-color-text-secondary)]">Notes</span>
        <textarea
          {...register('notes')}
          defaultValue={defaultValue?.notes ?? ''}
          rows={3}
          className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}
