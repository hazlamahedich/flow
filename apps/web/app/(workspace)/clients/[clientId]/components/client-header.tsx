'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@flow/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@flow/ui';
import { toggleArchive } from '../actions/toggle-archive';
import type { Client } from '@flow/types';

interface ClientHeaderProps {
  client: Client;
  role: string;
}

export function ClientHeader({ client, role }: ClientHeaderProps) {
  const router = useRouter();
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const statusDisplay = client.status === 'active'
    ? { label: 'Active', variant: 'success' as const }
    : { label: 'Archived', variant: 'secondary' as const };

  const handleToggleArchive = async () => {
    setIsPending(true);
    const result = await toggleArchive({
      clientId: client.id,
      action: client.status === 'active' ? 'archive' : 'restore',
    });
    setIsPending(false);
    if (result.success) {
      setShowArchiveDialog(false);
      router.refresh();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          {client.name}
        </h1>
        <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
      </div>
      {isOwnerOrAdmin && (
        <div className="flex gap-2">
          {client.status === 'active' ? (
            <button
              onClick={() => setShowArchiveDialog(true)}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Archive
            </button>
          ) : (
            <button
              onClick={handleToggleArchive}
              disabled={isPending}
              className="rounded-md bg-[var(--flow-color-bg-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Restoring...' : 'Restore'}
            </button>
          )}
        </div>
      )}

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Client</DialogTitle>
            <DialogDescription>
              This client will be hidden from active views. Time entries, invoices, and reports are preserved.
              You can restore this client at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setShowArchiveDialog(false)}
              className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleToggleArchive}
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? 'Archiving...' : 'Archive Client'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
