'use client';

import { useState, useCallback } from 'react';

interface EmailSentConfirmationProps {
  email: string;
  onResend: () => Promise<void>;
  onDifferentEmail: () => void;
}

export function EmailSentConfirmation({
  email,
  onResend,
  onDifferentEmail,
}: EmailSentConfirmationProps) {
  const [cooldown, setCooldown] = useState(30);
  const [resending, setResending] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(true);

  useState(() => {
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCooldownActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  });

  const handleResend = useCallback(async () => {
    if (cooldownActive || resending) return;
    setResending(true);
    try {
      await onResend();
      setCooldown(30);
      setCooldownActive(true);
    } finally {
      setResending(false);
    }
  }, [cooldownActive, resending, onResend]);

  return (
    <div className="w-full max-w-md space-y-4 text-center">
      <div className="rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--flow-color-text-primary)]">
          Check your email
        </h2>
        <p className="mb-4 text-sm text-[var(--flow-color-text-secondary)]">
          We sent a magic link to <strong className="text-[var(--flow-color-text-primary)]">{email}</strong>
        </p>

        <button
          onClick={handleResend}
          disabled={cooldownActive || resending}
          className="mb-3 w-full rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-secondary)] transition-colors hover:bg-[var(--flow-color-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending ? 'Sending...' : cooldownActive ? `Resend in ${cooldown}s` : 'Resend magic link'}
        </button>

        <button
          onClick={onDifferentEmail}
          className="text-sm text-[var(--flow-color-text-tertiary)] underline hover:text-[var(--flow-color-text-secondary)]"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
