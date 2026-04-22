'use client';

import {
  STEPS,
  getStepIndex,
  getStepLabel,
  getTotalSteps,
  type StepSlug,
} from '../_lib/steps';

interface StepIndicatorProps {
  currentStep: StepSlug;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = getStepIndex(currentStep);
  const total = getTotalSteps();

  return (
    <nav aria-label="Onboarding progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <li key={step}>
              <div
                role="presentation"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${total}: ${getStepLabel(step)}`}
                className={[
                  'h-2 rounded-full transition-all',
                  isCurrent
                    ? 'w-8 bg-[var(--flow-color-primary)]'
                    : isCompleted
                      ? 'w-2 bg-[var(--flow-color-primary)]'
                      : 'w-2 bg-[var(--flow-color-border)]',
                ].join(' ')}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
