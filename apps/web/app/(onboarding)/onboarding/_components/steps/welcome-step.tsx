'use client';

import { useRouter } from 'next/navigation';

export function WelcomeStep() {
  const router = useRouter();

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-foreground)]">
        Let&apos;s set up your workspace
      </h1>
      <p className="mt-4 text-[var(--flow-color-muted-foreground)]">
        Flow OS helps you manage clients, time, and communications — powered by
        AI agents that learn your style.
      </p>
      <div className="mt-8">
        <button
          type="button"
          onClick={() => router.push('/onboarding/agent-demo')}
          className="px-6 py-3 text-sm font-medium rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] text-white"
        >
          Begin
        </button>
      </div>
    </div>
  );
}
