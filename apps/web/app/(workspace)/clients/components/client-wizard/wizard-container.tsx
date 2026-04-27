'use client';

import { useTransition, useRef, useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setupClientWizard } from '../../actions/setup-client-wizard';
import { useWizardState } from './use-wizard-state';
import { WizardProgress } from './wizard-progress';
import { StepContact } from './step-contact';
import { StepBilling } from './step-billing';
import { StepRetainer } from './step-retainer';
import { StepReview } from './step-review';
import type { WizardStep } from '../../actions/wizard-types';

interface WizardContainerProps {
  onDataChange?: (hasData: boolean) => void;
}

function buildToastUrl(clientId: string, toast: { code: string; message: string; linkLabel?: string; linkHref?: string }): string {
  const params = new URLSearchParams({ toast_code: toast.code, toast_msg: toast.message });
  if (toast.linkLabel) params.set('toast_link_label', toast.linkLabel);
  if (toast.linkHref) params.set('toast_link_href', toast.linkHref);
  return `/clients/${clientId}?${params.toString()}`;
}

export function WizardContainer({ onDataChange }: WizardContainerProps) {
  const router = useRouter();
  const { state, goToStep, nextStep, prevStep, skipRetainer, updateContact, updateBilling, updateRetainer, resetState } = useWizardState();
  const [isPending, startTransition] = useTransition();
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const hasData = state.contactData.name.trim() !== '' ||
      (state.contactData.email !== undefined && state.contactData.email.trim() !== '') ||
      (state.billingData.address !== undefined && state.billingData.address.trim() !== '') ||
      (state.billingData.notes !== undefined && state.billingData.notes.trim() !== '') ||
      state.billingData.hourly_rate_cents != null ||
      state.retainerData !== null;
    onDataChange?.(hasData);
  }, [state, onDataChange]);

  const focusStepHeading = useCallback((_step: WizardStep) => {
    requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
  }, []);

  const handleGoToStep = useCallback((step: WizardStep) => {
    goToStep(step);
    focusStepHeading(step);
  }, [goToStep, focusStepHeading]);

  const handleNext = useCallback(() => {
    nextStep();
    focusStepHeading((state.step + 1) as WizardStep);
  }, [nextStep, state.step, focusStepHeading]);

  const handlePrev = useCallback(() => {
    prevStep();
    focusStepHeading((state.step - 1) as WizardStep);
  }, [prevStep, state.step, focusStepHeading]);

  const handleSkipRetainer = useCallback(() => {
    skipRetainer();
    focusStepHeading(4);
  }, [skipRetainer, focusStepHeading]);

  const handleSubmit = useCallback(() => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError(null);
    setErrorCode(null);

    startTransition(async () => {
      try {
        const clientData = {
          name: state.contactData.name,
          email: state.contactData.email || undefined,
          phone: state.contactData.phone || undefined,
          companyName: state.contactData.company_name || undefined,
          address: state.billingData.address || undefined,
          notes: state.billingData.notes || undefined,
          billingEmail: state.billingData.billing_email || undefined,
          hourlyRateCents: state.billingData.hourly_rate_cents ?? undefined,
        };

        const result = await setupClientWizard({
          clientData,
          retainerData: state.retainerData ?? undefined,
        });

        if (!result.success) {
          setError(result.error.message);
          setErrorCode(result.error.code);
          isSubmittingRef.current = false;
          return;
        }

        const clientId = result.data.client.id;
        isSubmittingRef.current = false;

        if (result.data.warning) {
          router.push(buildToastUrl(clientId, {
            code: result.data.warning.code,
            message: 'Client created! Retainer setup didn\'t complete.',
            linkLabel: 'Try again',
            linkHref: `/clients/${clientId}`,
          }));
        } else if (!result.data.retainer) {
          router.push(buildToastUrl(clientId, {
            code: 'NO_RETAINER',
            message: 'Client created!',
            linkLabel: 'Set up retainer',
            linkHref: `/clients/${clientId}`,
          }));
        } else {
          router.push(buildToastUrl(clientId, { code: 'CREATED', message: 'Client created!' }));
        }

        resetState();
      } catch {
        setError('Something went wrong. Please try again.');
        isSubmittingRef.current = false;
      }
    });
  }, [state, resetState, router]);

  const renderStep = () => {
    switch (state.step) {
      case 1:
        return (
          <StepContact
            data={state.contactData}
            onChange={updateContact}
            onNext={handleNext}
            headingRef={stepHeadingRef}
          />
        );
      case 2:
        return (
          <StepBilling
            data={state.billingData}
            onChange={updateBilling}
            onNext={handleNext}
            onBack={handlePrev}
            headingRef={stepHeadingRef}
          />
        );
      case 3:
        return (
          <StepRetainer
            data={state.retainerData}
            onChange={updateRetainer}
            onNext={handleNext}
            onBack={handlePrev}
            onSkip={handleSkipRetainer}
            headingRef={stepHeadingRef}
          />
        );
      case 4:
        return (
          <StepReview
            contactData={state.contactData}
            billingData={state.billingData}
            retainerData={state.retainerData}
            retainerSkipped={state.retainerSkipped}
            onSubmit={handleSubmit}
            onGoToStep={handleGoToStep}
            isSubmitting={isPending || isSubmittingRef.current}
            error={error}
            errorCode={errorCode}
            headingRef={stepHeadingRef}
          />
        );
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <WizardProgress currentStep={state.step} />
      <div className="mt-6">
        {renderStep()}
      </div>
    </div>
  );
}
