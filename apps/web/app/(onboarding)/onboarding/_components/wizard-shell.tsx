'use client';

import { useRouter } from 'next/navigation';
import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useReducedMotion, useFocusTrap } from '@flow/ui';
import {
  getStepIndex,
  getPreviousStep,
  getTotalSteps,
  COMPLETION_STEP,
  type StepSlug,
} from '../_lib/steps';
import { setOnboardingProgress } from '../_lib/storage';
import { StepIndicator } from './step-indicator';

interface WizardShellProps {
  children: ReactNode;
  currentStep: StepSlug;
}

export function WizardShell({ children, currentStep }: WizardShellProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const trap = useFocusTrap<HTMLDivElement>({ enabled: true });
  const currentIndex = getStepIndex(currentStep);
  const isFirstStep = currentIndex === 0;
  const isCompletion = currentStep === COMPLETION_STEP;
  const prevStep = getPreviousStep(currentStep);

  useEffect(() => {
    setOnboardingProgress(currentStep);
  }, [currentStep]);

  useEffect(() => {
    if (contentRef.current) {
      const focusable = contentRef.current.querySelector<HTMLElement>(
        'h1, h2, [tabindex], button, input',
      );
      focusable?.focus({ preventScroll: prefersReducedMotion });
    }
  }, [currentStep, prefersReducedMotion]);

  const handleBack = useCallback(() => {
    if (!prevStep) return;
    router.push(`/onboarding/${prevStep}`);
  }, [prevStep, router]);

  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      trap.ref(node);
    },
    [trap],
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <StepIndicator currentStep={currentStep} />

        <div ref={setContentRef}>
          {children}
        </div>

        {!isCompletion && (
          <div className="mt-8 flex justify-between">
            {!isFirstStep ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
