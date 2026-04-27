import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardState } from '../use-wizard-state';

describe('useWizardState navigation', () => {
  it('starts at step 1', () => {
    const { result } = renderHook(() => useWizardState());
    expect(result.current.state.step).toBe(1);
  });

  it('progresses from 1 to 2', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.nextStep());
    expect(result.current.state.step).toBe(2);
  });

  it('goes back from 2 to 1', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.nextStep());
    act(() => result.current.prevStep());
    expect(result.current.state.step).toBe(1);
  });

  it('preserves contact data on navigation', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.updateContact({ name: 'Alice' }));
    act(() => result.current.nextStep());
    act(() => result.current.prevStep());
    expect(result.current.state.contactData.name).toBe('Alice');
  });

  it('skips retainer to step 4', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.skipRetainer());
    expect(result.current.state.step).toBe(4);
    expect(result.current.state.retainerSkipped).toBe(true);
  });

  it('preserves billing data on round-trip navigation', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.updateBilling({ billing_email: 'b@test.com' }));
    act(() => result.current.nextStep());
    act(() => result.current.goToStep(1));
    act(() => result.current.goToStep(2));
    expect(result.current.state.billingData.billing_email).toBe('b@test.com');
  });

  it('does not go below step 1', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.prevStep());
    expect(result.current.state.step).toBe(1);
  });

  it('does not exceed step 4', () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.nextStep());
    act(() => result.current.nextStep());
    act(() => result.current.nextStep());
    act(() => result.current.nextStep());
    expect(result.current.state.step).toBe(4);
  });
});
