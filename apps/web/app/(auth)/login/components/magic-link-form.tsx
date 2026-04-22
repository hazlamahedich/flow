'use client';

import { useActionState, useState, useEffect } from 'react';
import { sendMagicLink } from '../actions/send-magic-link';
import { EmailSentConfirmation } from './email-sent-confirmation';
import { ExpiredLinkMessage } from './expired-link-message';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function MagicLinkForm() {
  const [state, formAction, isPending] = useActionState(sendMagicLink, null);
  const [email, setEmail] = useState('');
  const [showSent, setShowSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [emailChangedMessage, setEmailChangedMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    const messageParam = params.get('message');

    if (messageParam === 'email-changed') {
      setEmailChangedMessage(
        'Your email has been updated. Please sign in with your new email address.',
      );
      return;
    }

    if ((errorParam === 'access_denied' || errorParam === 'expired') && !urlError) {
      setUrlError(errorParam);
      const emailParam = params.get('email');
      if (emailParam) setEmail(emailParam);
    }
  }, [urlError]);

  useEffect(() => {
    if (state?.success && !showSent) {
      setSentEmail(email);
      setShowSent(true);
    }
  }, [state, showSent, email]);

  if (urlError === 'access_denied' || urlError === 'expired') {
    return <ExpiredLinkMessage email={email} />;
  }

  if (showSent && sentEmail) {
    return (
      <EmailSentConfirmation
        email={sentEmail}
        onResend={async () => {
          const formData = new FormData();
          formData.set('email', sentEmail);
          if (trustDevice) formData.set('trustDevice', 'true');
          formAction(formData);
        }}
        onDifferentEmail={() => {
          setShowSent(false);
          setSentEmail('');
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--flow-color-text-primary)]">
          Sign in to Flow
        </h1>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          Enter your email and we&apos;ll send you a magic link
        </p>
      </div>

      {emailChangedMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {emailChangedMessage}
        </div>
      )}

      <form
        action={(formData: FormData) => {
          const emailValue = formData.get('email');
          if (emailValue && typeof emailValue === 'string') {
            setEmail(emailValue);
          }
          if (trustDevice) formData.set('trustDevice', 'true');
          formAction(formData);
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-[var(--flow-color-text-secondary)]"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] px-3 py-2 text-sm text-[var(--flow-color-text-primary)] placeholder:text-[var(--flow-color-text-tertiary)] focus:border-[var(--flow-color-accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--flow-color-accent-primary)]"
            aria-describedby={state && !state.success ? 'email-error' : undefined}
          />
        </div>

        {state && !state.success && (
          <p id="email-error" className="text-sm text-red-400" role="alert">
            {state.error.message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <input
            id="trustDevice"
            name="trustDevice"
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--flow-color-border-default)] text-[var(--flow-color-accent-primary)] focus:ring-[var(--flow-color-accent-primary)]"
          />
          <label
            htmlFor="trustDevice"
            className="text-sm text-[var(--flow-color-text-secondary)]"
          >
            Trust this device
          </label>
        </div>

        <button
          type="submit"
          disabled={isPending || !email || !isValidEmail(email)}
          className="w-full rounded-md bg-[var(--flow-color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
    </div>
  );
}
