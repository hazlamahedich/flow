'use client';

import { useActionState } from 'react';
import { approveReportAction } from '@/lib/actions/portal/approve-report';
import type { PortalContext } from '@/lib/actions/portal/helpers';

/**
 * Approve report button (Client Component).
 *
 * Story 9.2 — AC4 (FR53).
 */
interface ApproveReportButtonProps {
  portalCtx: PortalContext;
  reportId: string;
}

export function ApproveReportButton({ portalCtx, reportId }: ApproveReportButtonProps) {
  const [state, formAction, isPending] = useActionState(
    async () => approveReportAction(portalCtx, { reportId }),
    null,
  );

  const errorMsg = state && !state.success ? state.error.message : null;
  const success = state?.success === true;

  return (
    <form action={formAction} className="space-y-2">
      <button
        type="submit"
        disabled={isPending || success}
        aria-live="polite"
        className="px-4 py-2 rounded-lg font-medium text-[var(--flow-bg-canvas)] disabled:opacity-50"
        style={{ background: 'var(--portal-accent)' }}
      >
        {isPending ? 'Approving...' : success ? 'Approved!' : 'Approve Report'}
      </button>
      {success && (
        <p className="text-sm text-[var(--flow-text-muted)]">Thanks — your report is approved.</p>
      )}
      {errorMsg && <p className="mt-2 text-sm text-red-600" role="alert">{errorMsg}</p>}
    </form>
  );
}
