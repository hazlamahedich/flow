'use client';

import type { WizardStep } from '../../actions/wizard-types';

interface WizardProgressProps {
  currentStep: WizardStep;
}

const STEPS = [
  { step: 1 as WizardStep, label: 'Contact' },
  { step: 2 as WizardStep, label: 'Billing' },
  { step: 3 as WizardStep, label: 'Retainer' },
  { step: 4 as WizardStep, label: 'Review' },
];

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const progressPercent = Math.round(((currentStep - 1) / 3) * 100);
  const valueText = `Step ${currentStep} of 4: ${STEPS[currentStep - 1]?.label ?? ''}`;

  return (
    <div className="sticky top-0 z-10 bg-[var(--flow-color-bg-primary)] pb-4">
      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuetext={valueText}
        className="hidden sm:block"
      >
        <div className="flex items-center justify-between">
          {STEPS.map((s) => {
            const isCompleted = s.step < currentStep;
            const isCurrent = s.step === currentStep;
            return (
              <div key={s.step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                      isCompleted
                        ? 'bg-[var(--flow-accent-primary)] text-white'
                        : isCurrent
                          ? 'bg-[var(--flow-accent-primary)] text-white'
                          : 'bg-[var(--flow-color-bg-tertiary)] text-[var(--flow-color-text-tertiary)]'
                    }`}
                  >
                    {isCompleted ? '✓' : s.step}
                  </div>
                  <span className={`mt-1 text-xs ${isCurrent ? 'font-medium text-[var(--flow-color-text-primary)]' : 'text-[var(--flow-color-text-tertiary)]'}`}>
                    {s.label}
                  </span>
                </div>
                {s.step < 4 && (
                  <div className={`mx-2 h-0.5 flex-1 ${s.step < currentStep ? 'bg-[var(--flow-accent-primary)]' : 'bg-[var(--flow-color-bg-tertiary)]'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="block sm:hidden">
        <div className="h-1.5 w-full rounded-full bg-[var(--flow-color-bg-tertiary)]">
          <div
            className="h-1.5 rounded-full bg-[var(--flow-accent-primary)] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <p className="sr-only">{valueText}</p>
    </div>
  );
}
