'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@flow/ui';

interface ConfirmRevokeDialogProps {
  memberName: string;
  isActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmRevokeDialog({
  memberName,
  isActive,
  onConfirm,
  onCancel,
  open,
  onOpenChange,
}: ConfirmRevokeDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Confirm revocation">
        <DialogHeader>
          <DialogTitle className="text-red-700">
            Revoke Access
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p>
                <strong>{memberName}</strong> will be immediately signed out
                and lose access to all workspace data.
              </p>
              {isActive && (
                <span className="inline-block rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  This user is currently active
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-primary)]"
            aria-label="Cancel revocation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            aria-label="Confirm revoke access"
          >
            {isConfirming ? 'Revoking...' : 'Revoke Access'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
