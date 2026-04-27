'use client';

import { useState } from 'react';
import type { BillingData } from '../../actions/wizard-types';
import { parseDollarToCents, formatCentsToDollar } from './dollar-cents';

interface StepBillingProps {
  data: BillingData;
  onChange: (data: BillingData) => void;
  onNext: () => void;
  onBack: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function StepBilling({ data, onChange, onNext, onBack, headingRef }: StepBillingProps) {
  const [rateDisplay, setRateDisplay] = useState(formatCentsToDollar(data.hourly_rate_cents ?? null));
  const [charCount, setCharCount] = useState((data.notes ?? '').length);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const display = e.target.value;
    setRateDisplay(display);
    onChange({ ...data, hourly_rate_cents: parseDollarToCents(display) });
  };

  const handleBillingEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, billing_email: e.target.value });
  };

  const handleAddress = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, address: e.target.value });
  };

  const handleNotes = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCharCount(val.length);
    onChange({ ...data, notes: val });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
          Billing & Notes
        </h2>
        <p className="mt-1 text-xs text-[var(--flow-color-text-tertiary)]">Optional — you can add these details later.</p>
      </div>

      <div>
        <label htmlFor="wiz-billing-email" className="mb-1 block text-sm font-medium">Billing Email</label>
        <input
          id="wiz-billing-email"
          type="email"
          value={data.billing_email ?? ''}
          onChange={handleBillingEmail}
          enterKeyHint="next"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="optional"
        />
      </div>

      <div>
        <label htmlFor="wiz-rate" className="mb-1 block text-sm font-medium">Hourly Rate ($)</label>
        <input
          id="wiz-rate"
          type="number"
          step="0.01"
          min="0"
          value={rateDisplay}
          onChange={handleRateChange}
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="wiz-address" className="mb-1 block text-sm font-medium">Address</label>
        <input
          id="wiz-address"
          type="text"
          value={data.address ?? ''}
          onChange={handleAddress}
          maxLength={500}
          enterKeyHint="next"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="optional"
        />
      </div>

      <div>
        <label htmlFor="wiz-notes" className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          id="wiz-notes"
          value={data.notes ?? ''}
          onChange={handleNotes}
          onKeyDown={handleKeyDown}
          maxLength={5000}
          rows={3}
          className="w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
        />
        <span className="text-xs text-[var(--flow-color-text-tertiary)]">{charCount}/5000</span>
      </div>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm sm:w-auto w-full"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="min-h-[44px] min-w-[44px] rounded-md bg-[var(--flow-accent-primary)] px-6 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] sm:w-auto w-full"
        >
          Next
        </button>
      </div>
    </div>
  );
}
