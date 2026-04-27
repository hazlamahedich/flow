'use client';

import type { ContactData, BillingData, RetainerFormData, WizardStep } from '../../actions/wizard-types';
import { formatCentsToDollar } from './dollar-cents';
import { TierLimitBanner } from '../tier-limit-banner';

interface StepReviewProps {
  contactData: ContactData;
  billingData: BillingData;
  retainerData: RetainerFormData | null;
  retainerSkipped: boolean;
  onSubmit: () => void;
  onGoToStep: (step: WizardStep) => void;
  isSubmitting: boolean;
  error: string | null;
  errorCode?: string | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function StepReview({
  contactData,
  billingData,
  retainerData,
  retainerSkipped,
  onSubmit,
  onGoToStep,
  isSubmitting,
  error,
  errorCode,
  headingRef,
}: StepReviewProps) {
  const hasBillingData = billingData.billing_email || billingData.hourly_rate_cents !== undefined || billingData.address || billingData.notes;

  return (
    <div className="space-y-6">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
        Review & Confirm
      </h2>

      <section className="rounded-lg border border-[var(--flow-color-border-default)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Contact Details</h3>
          <button type="button" onClick={() => onGoToStep(1)} className="text-xs text-[var(--flow-accent-primary)]">
            Edit
          </button>
        </div>
        <dl className="mt-2 space-y-1 text-sm">
          <div><dt className="inline text-[var(--flow-color-text-secondary)]">Name: </dt><dd className="inline">{contactData.name}</dd></div>
          {contactData.email && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Email: </dt><dd className="inline">{contactData.email}</dd></div>}
          {contactData.phone && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Phone: </dt><dd className="inline">{contactData.phone}</dd></div>}
          {contactData.company_name && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Company: </dt><dd className="inline">{contactData.company_name}</dd></div>}
        </dl>
      </section>

      <section className="rounded-lg border border-[var(--flow-color-border-default)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Billing & Notes</h3>
          <button type="button" onClick={() => onGoToStep(2)} className="text-xs text-[var(--flow-accent-primary)]">
            Edit
          </button>
        </div>
        {hasBillingData ? (
          <dl className="mt-2 space-y-1 text-sm">
            {billingData.billing_email && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Billing Email: </dt><dd className="inline">{billingData.billing_email}</dd></div>}
            {billingData.hourly_rate_cents != null && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Hourly Rate: </dt><dd className="inline">${formatCentsToDollar(billingData.hourly_rate_cents)}/hr</dd></div>}
            {billingData.address && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Address: </dt><dd className="inline">{billingData.address}</dd></div>}
            {billingData.notes && <div><dt className="inline text-[var(--flow-color-text-secondary)]">Notes: </dt><dd className="inline">{billingData.notes.slice(0, 100)}{billingData.notes.length > 100 ? '...' : ''}</dd></div>}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--flow-color-text-tertiary)]">No billing details added.</p>
        )}
      </section>

      <section className="rounded-lg border border-[var(--flow-color-border-default)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Retainer</h3>
          {!retainerSkipped && <button type="button" onClick={() => onGoToStep(3)} className="text-xs text-[var(--flow-accent-primary)]">Edit</button>}
        </div>
        {retainerSkipped ? (
          <p className="mt-2 text-sm text-[var(--flow-color-text-tertiary)]">Skipped — you can set this up later.</p>
        ) : retainerData ? (
          <dl className="mt-2 space-y-1 text-sm">
            <div><dt className="inline text-[var(--flow-color-text-secondary)]">Type: </dt><dd className="inline">{retainerData.type.replace('_', ' ')}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--flow-color-text-tertiary)]">No retainer configured.</p>
        )}
      </section>

      {error && errorCode === 'CLIENT_LIMIT_REACHED' && (
        <TierLimitBanner activeCount={5} limit={5} tierName="Free" />
      )}
      {error && errorCode !== 'CLIENT_LIMIT_REACHED' && (
        <div className="rounded-md border border-[var(--flow-status-warning)] bg-[var(--flow-status-warning)]/10 p-3 text-sm text-[var(--flow-status-warning)]">
          {error}
        </div>
      )}

      <div className="pt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="min-h-[44px] w-full rounded-md bg-[var(--flow-accent-primary)] px-6 py-3 text-sm font-medium text-[var(--flow-accent-primary-text)] disabled:opacity-50 sm:w-auto"
        >
          {isSubmitting ? 'Creating...' : 'Create Client'}
        </button>
      </div>
    </div>
  );
}
