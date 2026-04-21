'use client';

import { useState } from 'react';

interface ExpiredLinkMessageProps {
  email: string;
}

export function ExpiredLinkMessage({ email }: ExpiredLinkMessageProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      const formData = new FormData();
      formData.set('email', email);
      const { sendMagicLink } = await import('../actions/send-magic-link');
      await sendMagicLink(null, formData);
      setResent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md text-center">
      <div className="rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--flow-color-text-primary)]">
          This link has expired
        </h2>
        <p className="mb-4 text-sm text-[var(--flow-color-text-secondary)]">
          {resent
            ? 'A new link has been sent. Check your email.'
            : 'The magic link you used has expired. Please request a new one.'}
        </p>
        {!resent && (
          <button
            onClick={handleResend}
            disabled={resending || !email}
            className="rounded-md bg-[var(--flow-color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Send new link'}
          </button>
        )}
        {resent && (
          <a
            href="/login"
            className="text-sm text-[var(--flow-color-text-tertiary)] underline hover:text-[var(--flow-color-text-secondary)]"
          >
            Back to login
          </a>
        )}
      </div>
    </div>
  );
}
