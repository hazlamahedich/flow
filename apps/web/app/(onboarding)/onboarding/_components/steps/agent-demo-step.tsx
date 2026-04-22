'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from '@flow/ui';

interface AgentDemoStepProps {
  demoDelayMs?: number;
}

export function AgentDemoStep({ demoDelayMs = 1500 }: AgentDemoStepProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [showDraft, setShowDraft] = useState(prefersReducedMotion || demoDelayMs === 0);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion || demoDelayMs === 0) {
      setShowDraft(true);
      return;
    }

    const timer = setTimeout(() => setShowDraft(true), demoDelayMs);
    return () => clearTimeout(timer);
  }, [demoDelayMs, prefersReducedMotion]);

  const handleContinue = useCallback(() => {
    router.push('/onboarding/create-client');
  }, [router]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--flow-color-foreground)]">
        Your Day, Organized
      </h1>

      {showDraft && (
        <div className="mt-6 space-y-4">
          <div className="rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border)] p-4">
            <p className="text-sm font-medium text-[var(--flow-color-foreground)]">
              Inbox Agent detected a double-booking conflict for coaching client
              &ldquo;Marcus&rdquo; and drafted a reschedule email.
            </p>

            <div className="mt-3 rounded-[var(--flow-radius-md)] bg-[var(--flow-color-muted)] p-3">
              <p className="text-sm text-[var(--flow-color-foreground)]">
                Hi Marcus, I noticed a scheduling conflict with our session this
                week. Could we move to Thursday at 2pm?
                <button
                  type="button"
                  className="inline-flex items-center ml-1 text-[var(--flow-color-primary)] underline decoration-dotted"
                  aria-describedby="imperfection-tooltip"
                  onClick={() => setTooltipOpen(!tooltipOpen)}
                  onBlur={() => setTooltipOpen(false)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setTooltipOpen(false); }}
                >
                  [confirm meeting time]
                </button>
              </p>
              {tooltipOpen && (
                <div
                  id="imperfection-tooltip"
                  role="tooltip"
                  className="mt-2 text-xs text-[var(--flow-color-muted-foreground)] italic"
                >
                  Tap to personalize — your agent learns from every edit
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-[var(--flow-color-muted-foreground)]">
              Sample Agent Draft — your real drafts will learn your voice
            </p>
          </div>

          <p className="text-sm text-[var(--flow-color-muted-foreground)]">
            Your Inbox Agent is learning how you write. Every edit you make
            teaches it. Within a week, it&apos;ll sound like you.
          </p>

          <div className="rounded-[var(--flow-radius-md)] bg-[var(--flow-color-muted)] p-3">
            <p className="text-sm font-medium text-[var(--flow-color-foreground)]">
              In your first week, your agents will save you an estimated 5
              hours.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!showDraft}
          className="px-6 py-3 text-sm font-medium rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
