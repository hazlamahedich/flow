'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '../../_actions/complete-onboarding';
import { clearOnboardingProgress } from '../../_lib/storage';

export function CompletionStep() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await completeOnboarding();

    if (!result.success) {
      setError(result.error.message);
      setIsSubmitting(false);
      return;
    }

    clearOnboardingProgress();
    router.push('/');
  }, [router]);

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-foreground)]">
        Workspace ready
      </h1>
      <p className="mt-4 text-[var(--flow-color-muted-foreground)]">
        Your workspace is set up and ready to go.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={handleComplete}
          disabled={isSubmitting}
          className="px-6 py-3 text-sm font-medium rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Setting up...' : 'Go to Workspace'}
        </button>
      </div>
    </div>
  );
}
