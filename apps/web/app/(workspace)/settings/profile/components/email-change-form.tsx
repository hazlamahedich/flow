'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@flow/types';

interface EmailChangeFormProps {
  requestAction: (input: unknown) => Promise<ActionResult<{ pendingEmail: string }>>;
}

export function EmailChangeForm({ requestAction }: EmailChangeFormProps) {
  const [state, submitAction, isPending] = useActionState(
    async (prev: ActionResult<{ pendingEmail: string }> | null, formData: FormData) => {
      const newEmail = String(formData.get('newEmail') ?? '');
      return requestAction({ newEmail });
    },
    null,
  );

  const successMessage = state?.success
    ? `Verification email sent to ${state.data.pendingEmail}. Check your inbox.`
    : null;
  const errorMessage = state && !state.success ? state.error.message : null;

  return (
    <div className="space-y-3">
      <form action={submitAction} className="flex items-end gap-3">
        <div className="flex-1 max-w-md space-y-1">
          <label
            htmlFor="new-email"
            className="text-sm font-medium text-[var(--flow-color-text-secondary)]"
          >
            New email address
          </label>
          <input
            id="new-email"
            name="newEmail"
            type="email"
            required
            autoComplete="email"
            placeholder="new@example.com"
            className="flex h-10 w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--flow-color-text-primary)] placeholder:text-[var(--flow-color-text-muted)] focus-visible:outline-none focus-visible:ring-[var(--flow-focus-ring-width)] focus-visible:ring-offset-[var(--flow-focus-ring-offset)] focus-visible:ring-[var(--flow-focus-ring-color)]"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-[var(--flow-radius-md)] bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] hover:brightness-[var(--flow-state-hover-brightness)] disabled:opacity-50"
        >
          {isPending ? 'Sending...' : 'Change email'}
        </button>
      </form>

      {successMessage && (
        <p className="text-sm text-[var(--flow-status-success)]">{successMessage}</p>
      )}
      {errorMessage && (
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
