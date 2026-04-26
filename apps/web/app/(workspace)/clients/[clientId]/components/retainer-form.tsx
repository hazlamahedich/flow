'use client';

import { useState } from 'react';
import type { Retainer } from '@flow/types';
import { createRetainerAction } from '../actions/retainer/create-retainer';
import { updateRetainerAction } from '../actions/retainer/update-retainer';

interface RetainerFormProps {
  retainer?: Retainer;
  clientId: string;
  onCancel: () => void;
}

type RetainerType = 'hourly_rate' | 'flat_monthly' | 'package_based';

const TYPE_CARDS: { type: RetainerType; title: string; description: string }[] = [
  { type: 'hourly_rate', title: 'Hourly Rate', description: 'Bill by the hour at a fixed rate' },
  { type: 'flat_monthly', title: 'Flat Monthly', description: 'Fixed fee per billing period' },
  { type: 'package_based', title: 'Package', description: 'Set hours for a defined package' },
];

export function RetainerForm({ retainer, clientId, onCancel }: RetainerFormProps) {
  const isEdit = !!retainer;
  const [selectedType, setSelectedType] = useState<RetainerType>(retainer?.type ?? 'hourly_rate');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    try {
      if (isEdit && retainer) {
        const rateVal = data.hourlyRateCents ? Math.round(parseFloat(data.hourlyRateCents as string) * 100) : null;
        const feeVal = data.monthlyFeeCents ? Math.round(parseFloat(data.monthlyFeeCents as string) * 100) : null;
        if (rateVal !== null && isNaN(rateVal)) { setError('Invalid hourly rate.'); return; }
        if (feeVal !== null && isNaN(feeVal)) { setError('Invalid monthly fee.'); return; }
        const result = await updateRetainerAction({
          retainerId: retainer.id,
          hourlyRateCents: rateVal,
          monthlyFeeCents: feeVal,
          monthlyHoursThreshold: (data.monthlyHoursThreshold as string) || null,
          packageHours: (data.packageHours as string) || null,
          packageName: (data.packageName as string) || null,
          billingPeriodDays: data.billingPeriodDays ? parseInt(data.billingPeriodDays as string) : undefined,
          notes: (data.notes as string) || null,
          endDate: (data.endDate as string) || null,
        });
        if (!result.success) {
          setError(result.error.message);
          return;
        }
      } else {
        const base: Record<string, unknown> = {
          type: selectedType,
          clientId,
          billingPeriodDays: data.billingPeriodDays ? parseInt(data.billingPeriodDays as string) : 30,
          notes: (data.notes as string) || '',
        };

        if (selectedType === 'hourly_rate') {
          base.hourlyRateCents = Math.round(parseFloat(data.hourlyRateCents as string) * 100);
        } else if (selectedType === 'flat_monthly') {
          base.monthlyFeeCents = Math.round(parseFloat(data.monthlyFeeCents as string) * 100);
          base.monthlyHoursThreshold = (data.monthlyHoursThreshold as string) || null;
        } else if (selectedType === 'package_based') {
          base.packageHours = (data.packageHours as string) || '0';
          base.packageName = (data.packageName as string) || '';
          if (data.hourlyRateCents) base.hourlyRateCents = Math.round(parseFloat(data.hourlyRateCents as string) * 100);
        }

        const result = await createRetainerAction(base);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
      }
      onCancel();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--flow-color-border-default)] p-6">
      <h3 className="text-sm font-semibold text-[var(--flow-color-text-primary)]">
        {isEdit ? 'Edit Retainer' : 'Create Retainer Agreement'}
      </h3>

      {error && (
        <p className="text-sm text-[var(--flow-status-error)]">{error}</p>
      )}

      {!isEdit && (
        <div className="grid grid-cols-3 gap-3">
          {TYPE_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => setSelectedType(card.type)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                selectedType === card.type
                  ? 'border-[var(--flow-accent-primary)] bg-[var(--flow-accent-primary)]/10'
                  : 'border-[var(--flow-color-border-default)]'
              }`}
            >
              <span className="font-medium">{card.title}</span>
              <span className="mt-1 block text-xs text-[var(--flow-color-text-secondary)]">{card.description}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {(selectedType === 'hourly_rate' || (isEdit && retainer?.type === 'hourly_rate')) && (
          <label className="block text-sm">
            <span className="text-[var(--flow-color-text-secondary)]">Rate ($/hr)</span>
            <input
              name="hourlyRateCents"
              type="number"
              step="0.01"
              min="0"
              defaultValue={retainer?.hourlyRateCents ? (retainer.hourlyRateCents / 100).toFixed(2) : ''}
              className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              required
            />
          </label>
        )}

        {(selectedType === 'flat_monthly' || (isEdit && retainer?.type === 'flat_monthly')) && (
          <>
            <label className="block text-sm">
              <span className="text-[var(--flow-color-text-secondary)]">Monthly Fee ($)</span>
              <input
                name="monthlyFeeCents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={retainer?.monthlyFeeCents ? (retainer.monthlyFeeCents / 100).toFixed(2) : ''}
                className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--flow-color-text-secondary)]">Hours Threshold</span>
              <input
                name="monthlyHoursThreshold"
                type="text"
                defaultValue={retainer?.monthlyHoursThreshold ?? ''}
                placeholder="e.g., 30"
                className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
                required
              />
            </label>
          </>
        )}

        {(selectedType === 'package_based' || (isEdit && retainer?.type === 'package_based')) && (
          <>
            <label className="block text-sm">
              <span className="text-[var(--flow-color-text-secondary)]">Package Name</span>
              <input
                name="packageName"
                type="text"
                defaultValue={retainer?.packageName ?? ''}
                className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--flow-color-text-secondary)]">Package Hours</span>
              <input
                name="packageHours"
                type="text"
                defaultValue={retainer?.packageHours ?? ''}
                placeholder="e.g., 40"
                className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--flow-color-text-secondary)]">Overage Rate ($/hr, optional)</span>
              <input
                name="hourlyRateCents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={retainer?.hourlyRateCents ? (retainer.hourlyRateCents / 100).toFixed(2) : ''}
                className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              />
            </label>
          </>
        )}

        <label className="block text-sm">
          <span className="text-[var(--flow-color-text-secondary)]">Billing Period (days)</span>
          <input
            name="billingPeriodDays"
            type="number"
            min="1"
            max="365"
            defaultValue={retainer?.billingPeriodDays ?? 30}
            className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="text-[var(--flow-color-text-secondary)]">End Date (optional)</span>
          <input
            name="endDate"
            type="date"
            defaultValue={retainer?.endDate ?? ''}
            className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="text-[var(--flow-color-text-secondary)]">Notes</span>
          <textarea
            name="notes"
            defaultValue={retainer?.notes ?? ''}
            rows={3}
            className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] disabled:opacity-50"
        >
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Retainer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
