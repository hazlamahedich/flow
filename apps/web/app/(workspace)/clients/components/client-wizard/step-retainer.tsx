'use client';

import { useState, useRef, useCallback } from 'react';
import type { RetainerType } from '@flow/types';
import type { RetainerFormData } from '../../actions/wizard-types';
import { wizardRetainerSchema } from '../../actions/wizard-types';
import { TYPE_CARDS, RetainerTypeFields } from '../retainer-type-fields';
import { parseDollarToCents } from './dollar-cents';

interface StepRetainerProps {
  data: RetainerFormData | null;
  onChange: (data: RetainerFormData) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function StepRetainer({ data, onChange, onNext, onBack, onSkip, headingRef }: StepRetainerProps) {
  const [expanded, setExpanded] = useState(data !== null);
  const [selectedType, setSelectedType] = useState<RetainerType | null>(data?.type ?? null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const radioGroupRef = useRef<HTMLDivElement>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const handleExpand = () => {
    setExpanded(true);
  };

  const handleTypeSelect = (type: RetainerType) => {
    setSelectedType(type);
    setValidationError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % TYPE_CARDS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + TYPE_CARDS.length) % TYPE_CARDS.length;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTypeSelect(TYPE_CARDS[index]!.type);
      return;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      const cards = radioGroupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
      cards?.[nextIndex]?.focus?.();
    }
  };

  const register = (name: string) => ({ name, 'data-field': name });

  const handleNext = useCallback(() => {
    if (!selectedType) {
      setValidationError('Please select a retainer type.');
      return;
    }

    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    const values: Record<string, unknown> = { type: selectedType };

    for (const [key, val] of fd.entries()) {
      if (key === 'hourlyRateCents' && typeof val === 'string' && val !== '') {
        const cents = parseDollarToCents(val);
        values[key] = cents ?? 0;
      } else {
        values[key] = val;
      }
    }

    const parsed = wizardRetainerSchema.safeParse(values);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Validation failed');
      return;
    }

    setValidationError(null);
    onChange(parsed.data);
    onNext();
  }, [selectedType, onChange, onNext]);

  if (!expanded) {
    return (
      <div className="space-y-4">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
          Set up a retainer agreement (optional)
        </h2>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleExpand}
            className="min-h-[44px] rounded-md bg-[var(--flow-accent-primary)] px-6 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)]"
          >
            Set up retainer
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[44px] rounded-md border border-[var(--flow-color-border-default)] px-6 py-2 text-sm text-[var(--flow-color-text-secondary)]"
          >
            I&apos;ll set this up later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
        Set up a retainer agreement (optional)
      </h2>

      <div
        ref={radioGroupRef}
        role="radiogroup"
        aria-label="Retainer type"
        className="grid grid-cols-3 gap-3"
      >
        {TYPE_CARDS.map((card, index) => (
          <div
            key={card.type}
            role="radio"
            tabIndex={index === 0 ? 0 : -1}
            aria-checked={selectedType === card.type}
            onClick={() => handleTypeSelect(card.type)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`min-h-[44px] cursor-pointer rounded-lg border p-3 text-left text-sm transition-colors ${
              selectedType === card.type
                ? 'border-[var(--flow-accent-primary)] bg-[var(--flow-accent-primary)]/10'
                : 'border-[var(--flow-color-border-default)]'
            }`}
          >
            <span className="font-medium">{card.title}</span>
            <span className="mt-1 block text-xs text-[var(--flow-color-text-secondary)]">{card.description}</span>
          </div>
        ))}
      </div>

      {validationError && (
        <p className="text-sm text-[var(--flow-status-error)]">{validationError}</p>
      )}

      <form ref={formRef} data-retainer-form>
        <RetainerTypeFields type={selectedType} register={register} />
      </form>

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
          onClick={handleNext}
          className="min-h-[44px] min-w-[44px] rounded-md bg-[var(--flow-accent-primary)] px-6 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] sm:w-auto w-full"
        >
          Next
        </button>
      </div>
    </div>
  );
}
