'use client';

import { useState, useTransition } from 'react';
import type { ClientInbox } from '@flow/types';
import { initiateOAuth } from '../actions/inbox/initiate-oauth';

interface ConnectInboxDialogProps {
  clientId: string;
  existingInbox: ClientInbox | null;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectInboxDialog({
  clientId,
  existingInbox,
  onClose,
  onConnected,
}: ConnectInboxDialogProps) {
  const [accessType, setAccessType] = useState<'direct' | 'delegated'>('direct');
  const [showDelegatedGuide, setShowDelegatedGuide] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      const result = await initiateOAuth({ clientId, accessType });
      if (result.success) {
        window.location.href = result.data.oauthUrl;
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
          {existingInbox ? 'Reconnect Inbox' : 'Connect Gmail Inbox'}
        </h2>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          {existingInbox
            ? `Reconnect ${existingInbox.emailAddress} to resume email processing.`
            : 'Connect a Gmail inbox to start processing emails for this client.'}
        </p>

        {!existingInbox && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium text-[var(--flow-color-text-primary)]">
              Access Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-md border border-[var(--flow-color-border-default)] p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="accessType"
                  value="direct"
                  checked={accessType === 'direct'}
                  onChange={() => setAccessType('direct')}
                  className="accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium">Direct access</span>
                  <p className="text-xs text-[var(--flow-color-text-secondary)]">
                    Your own Gmail account
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-[var(--flow-color-border-default)] p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="accessType"
                  value="delegated"
                  checked={accessType === 'delegated'}
                  onChange={() => setAccessType('delegated')}
                  className="accent-blue-600"
                />
                <div>
                  <span className="text-sm font-medium">Delegated access</span>
                  <p className="text-xs text-[var(--flow-color-text-secondary)]">
                    Client&apos;s Gmail account
                  </p>
                </div>
              </label>
            </div>

            {accessType === 'delegated' && !showDelegatedGuide && (
              <button
                type="button"
                onClick={() => setShowDelegatedGuide(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View delegated setup guide
              </button>
            )}

            {showDelegatedGuide && (
              <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                <p className="font-medium">Delegated Access Setup</p>
                <ol className="mt-1 list-decimal space-y-1 pl-4">
                  <li>Ask the client to grant access to your Google account</li>
                  <li>The client must add your email as a delegate in their Gmail settings</li>
                  <li>Once delegated, click Connect to authorize</li>
                </ol>
              </div>
            )}
          </div>
        )}

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
            onClick={handleConnect}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
