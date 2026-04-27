'use client';

import { useState, useEffect } from 'react';
import type { Retainer } from '@flow/types';
import { createRetainerAction } from '../actions/retainer/create-retainer';
import { updateRetainerAction } from '../actions/retainer/update-retainer';
import { TYPE_CARDS, RetainerTypeFields } from '../../components/retainer-type-fields';

interface RetainerFormProps {
  retainer?: Retainer;
  clientId: string;
  onCancel: () => void;
  onSuccess?: (message: string) => void;
}

type RetainerType = 'hourly_rate' | 'flat_monthly' | 'package_based';

function useIsMobile(breakpoint = 640): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

export function RetainerForm({ retainer, clientId, onCancel, onSuccess }: RetainerFormProps) {
  const isEdit = !!retainer;
  const isMobile = useIsMobile();
  const [selectedType, setSelectedType] = useState<RetainerType>(retainer?.type ?? 'hourly_rate');
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showFields = isEdit || !isMobile || mobileStep === 2;

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
      if (onSuccess) {
        onSuccess(isEdit ? 'Retainer updated successfully.' : 'Retainer created successfully.');
      }
      onCancel();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const register = (name: string) => ({ name });

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--flow-color-border-default)] p-6">
      <h3 className="text-sm font-semibold text-[var(--flow-color-text-primary)]">
        {isEdit ? 'Edit Retainer' : 'Create Retainer Agreement'}
      </h3>

      {error && (
        <p className="text-sm text-[var(--flow-status-error)]">{error}</p>
      )}

      {!isEdit && (
        <div className="space-y-3">
          {isMobile && mobileStep === 1 && (
            <p className="text-xs text-[var(--flow-color-text-secondary)]">Step 1 of 2 — Choose type</p>
          )}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3`}>
            {TYPE_CARDS.map((card: { type: RetainerType; title: string; description: string }) => (
              <button
                key={card.type}
                type="button"
                onClick={() => {
                  setSelectedType(card.type);
                  if (isMobile && mobileStep === 1) setMobileStep(2);
                }}
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
          {isMobile && mobileStep === 1 && (
            <button
              type="button"
              onClick={() => setMobileStep(2)}
              disabled={!selectedType}
              className="w-full rounded-md bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      )}

      {showFields && (
        <>
          {isMobile && !isEdit && mobileStep === 2 && (
            <button
              type="button"
              onClick={() => setMobileStep(1)}
              className="text-xs text-[var(--flow-accent-primary)] underline"
            >
              ← Change type
            </button>
          )}
          <RetainerTypeFields
            type={isEdit ? retainer.type : selectedType}
            register={register}
            defaultValue={{
              hourlyRateCents: retainer?.hourlyRateCents ? (retainer.hourlyRateCents / 100).toFixed(2) : null,
              monthlyFeeCents: retainer?.monthlyFeeCents ? (retainer.monthlyFeeCents / 100).toFixed(2) : null,
              monthlyHoursThreshold: retainer?.monthlyHoursThreshold ?? null,
              packageHours: retainer?.packageHours ?? null,
              packageName: retainer?.packageName ?? null,
              billingPeriodDays: retainer?.billingPeriodDays ?? 30,
              endDate: retainer?.endDate ?? null,
              notes: retainer?.notes ?? null,
            }}
          />
        </>
      )}

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
