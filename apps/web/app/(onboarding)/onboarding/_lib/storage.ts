'use client';

const STORAGE_KEY = 'flow-onboarding-progress';

export function getOnboardingProgress(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setOnboardingProgress(step: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, step);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded — onboarding progress not saved');
      return;
    }
    throw error;
  }
}

export function clearOnboardingProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore — localStorage may be unavailable
  }
}
