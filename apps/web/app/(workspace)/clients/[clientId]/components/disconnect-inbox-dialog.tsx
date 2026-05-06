'use client';

import { useState, useTransition } from 'react';
import type { ClientInbox } from '@flow/types';
import { disconnectInbox } from '../actions/inbox/disconnect-inbox';

interface DisconnectInboxDialogProps {
  inbox: ClientInbox;
  clientId: string;
  onClose: () => void;
  onDisconnected: () => void;
}

export function DisconnectInboxDialog({
  inbox,
  clientId,
  onClose,
  onDisconnected,
}: DisconnectInboxDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectInbox({ inboxId: inbox.id, clientId });
      if (result.success) {
        onDisconnected();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
          Disconnect Inbox
        </h2>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          Are you sure you want to disconnect <strong>{inbox.emailAddress}</strong>?
          This will stop email processing and revoke Gmail access. The inbox record will be
          preserved for audit history.
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}
