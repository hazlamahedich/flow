'use client';

import { useState, useEffect, useTransition } from 'react';
import type { ClientInbox } from '@flow/types';
import { getInboxStatus } from '../actions/inbox/get-inbox-status';
import { ConnectInboxDialog } from './connect-inbox-dialog';
import { DisconnectInboxDialog } from './disconnect-inbox-dialog';

interface InboxConnectionCardProps {
  clientId: string;
  role: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  connected: { label: 'Connected', color: 'text-green-700', bg: 'bg-green-50' },
  syncing: { label: 'Syncing', color: 'text-blue-700', bg: 'bg-blue-50' },
  error: { label: 'Error', color: 'text-red-700', bg: 'bg-red-50' },
  disconnected: { label: 'Disconnected', color: 'text-gray-500', bg: 'bg-gray-50' },
};

export function InboxConnectionCard({ clientId, role }: InboxConnectionCardProps) {
  const [inboxes, setInboxes] = useState<ClientInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState<ClientInbox | null>(null);
  const [isPending, startTransition] = useTransition();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    startTransition(async () => {
      const result = await getInboxStatus({ clientId });
      if (result.success) setInboxes(result.data);
      setLoading(false);
    });
  }, [clientId]);

  const hasConnected = inboxes.some(
    (i) => i.syncStatus === 'connected' || i.syncStatus === 'syncing',
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6">
        <h3 className="text-sm font-medium uppercase text-[var(--flow-color-text-secondary)]">
          Inbox Connection
        </h3>
        <div className="mt-4 animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase text-[var(--flow-color-text-secondary)]">
          Inbox Connection
        </h3>
        {isOwnerOrAdmin && (
          <button
            onClick={() => {
              setSelectedInbox(null);
              setShowConnect(true);
            }}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect Inbox
          </button>
        )}
      </div>

      {inboxes.length === 0 && (
        <p className="mt-3 text-sm text-[var(--flow-color-text-secondary)]">
          No inboxes connected. Connect a Gmail inbox to start processing emails.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {inboxes.map((inbox) => {
          const config = STATUS_CONFIG[inbox.syncStatus];
          if (!config) return null;
          return (
            <div
              key={inbox.id}
              className="flex items-center justify-between rounded-md border border-[var(--flow-color-border-default)] p-3"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                  {inbox.syncStatus === 'syncing' && (
                    <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {config.label}
                </span>
                <span className="text-sm text-[var(--flow-color-text-primary)]">{inbox.emailAddress}</span>
                {inbox.lastSyncAt && (
                  <span className="text-xs text-[var(--flow-color-text-secondary)]">
                    Last sync: {new Date(inbox.lastSyncAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {inbox.syncStatus === 'error' && isOwnerOrAdmin && (
                  <button
                    onClick={() => {
                      setSelectedInbox(inbox);
                      setShowConnect(true);
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Reconnect
                  </button>
                )}
                {(inbox.syncStatus === 'connected' || inbox.syncStatus === 'syncing') && isOwnerOrAdmin && (
                  <button
                    onClick={() => {
                      setSelectedInbox(inbox);
                      setShowDisconnect(true);
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Disconnect
                  </button>
                )}
                {inbox.syncStatus === 'disconnected' && isOwnerOrAdmin && (
                  <button
                    onClick={() => {
                      setSelectedInbox(inbox);
                      setShowConnect(true);
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Connect
                  </button>
                )}
              </div>
              {inbox.errorMessage && (
                <p className="mt-1 text-xs text-red-600">{inbox.errorMessage}</p>
              )}
            </div>
          );
        })}
      </div>

      {showConnect && (
        <ConnectInboxDialog
          clientId={clientId}
          existingInbox={selectedInbox}
          onClose={() => {
            setShowConnect(false);
            setSelectedInbox(null);
          }}
          onConnected={() => {
            setShowConnect(false);
            setSelectedInbox(null);
            startTransition(async () => {
              const result = await getInboxStatus({ clientId });
              if (result.success) setInboxes(result.data);
            });
          }}
        />
      )}

      {showDisconnect && selectedInbox && (
        <DisconnectInboxDialog
          inbox={selectedInbox}
          clientId={clientId}
          onClose={() => {
            setShowDisconnect(false);
            setSelectedInbox(null);
          }}
          onDisconnected={() => {
            setShowDisconnect(false);
            setSelectedInbox(null);
            startTransition(async () => {
              const result = await getInboxStatus({ clientId });
              if (result.success) setInboxes(result.data);
            });
          }}
        />
      )}
    </div>
  );
}
