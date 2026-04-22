'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOnboardingProgress } from './_lib/storage';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const saved = getOnboardingProgress();
    if (saved) {
      router.replace(`/onboarding/${saved}`);
    } else {
      router.replace('/onboarding/welcome');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[var(--flow-color-muted-foreground)]">Loading...</p>
    </div>
  );
}
