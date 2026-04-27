import { useState, useCallback } from 'react';
import type { WizardStep, ContactData, BillingData, RetainerFormData, WizardState } from '../../actions/wizard-types';

const INITIAL_STATE: WizardState = {
  step: 1,
  contactData: { name: '' },
  billingData: {},
  retainerData: null,
  retainerSkipped: false,
};

export function useWizardState() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      const next = Math.min(prev.step + 1, 4) as WizardStep;
      return { ...prev, step: next };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const prev_s = Math.max(prev.step - 1, 1) as WizardStep;
      return { ...prev, step: prev_s };
    });
  }, []);

  const skipRetainer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 4,
      retainerSkipped: true,
      retainerData: null,
    }));
  }, []);

  const updateContact = useCallback((data: ContactData) => {
    setState((prev) => ({ ...prev, contactData: data }));
  }, []);

  const updateBilling = useCallback((data: BillingData) => {
    setState((prev) => ({ ...prev, billingData: data }));
  }, []);

  const updateRetainer = useCallback((data: RetainerFormData) => {
    setState((prev) => ({ ...prev, retainerData: data, retainerSkipped: false }));
  }, []);

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    goToStep,
    nextStep,
    prevStep,
    skipRetainer,
    updateContact,
    updateBilling,
    updateRetainer,
    resetState,
  };
}
