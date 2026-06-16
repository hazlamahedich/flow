'use client';

import { useState, useActionState } from 'react';
import { requestReportChangesAction } from '@/lib/actions/portal/request-report-changes';
import type { PortalContext } from '@/lib/actions/portal/helpers';

/**
 * Request report changes form (Client Component).
 *
 * Story 9.2 — AC4 (FR53).
 */
interface RequestChangesFormProps {
  portalCtx: PortalContext;
  reportId: string;
}

export function RequestChangesForm({ portalCtx, reportId }: RequestChangesFormProps) {
  const [message, setMessage] = useState('');

  const [state, formAction, isPending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const msg = String(formData.get('message') ?? '');
      return requestReportChangesAction(portalCtx, { reportId, message: msg });
    },
    null,
  );

  const errorMsg = state && !state.success ? state.error.message : null;
  const success = state?.success === true;

  return (
    <form action={formAction} className="space-y-2" aria-live="polite">
      <textarea
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isPending || success}
        placeholder="Tell us what needs to change..."
        maxLength={2000}
        className="w-full p-3 rounded-lg border border-[var(--flow-border-default)] text-sm text-[var(--flow-text-primary)] bg-[var(--flow-bg-canvas)]"
        rows={3}
      />
      <button
        type="submit"
        disabled={isPending || success || message.trim().length === 0}
        className="px-4 py-2 rounded-lg font-medium text-[var(--flow-text-primary)] border border-[var(--flow-border-default)] disabled:opacity-50"
      >
        {isPending ? 'Sending...' : success ? 'Sent!' : 'Request Changes'}
      </button>
      {success && (
        <p className="text-sm text-[var(--flow-text-muted)]">Thanks — your feedback has been sent.</p>
      )}
      {errorMsg && <p className="text-sm text-red-600" role="alert">{errorMsg}</p>}
    </form>
  );
}
