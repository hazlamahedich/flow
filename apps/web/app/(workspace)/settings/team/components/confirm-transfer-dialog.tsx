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

interface ConfirmTransferDialogProps {
  workspaceName: string;
  targetName: string;
  targetIsActive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmTransferDialog({
  workspaceName,
  targetName,
  targetIsActive,
  onConfirm,
  onCancel,
  open,
  onOpenChange,
}: ConfirmTransferDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmInput, setConfirmInput] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  function handleNext() {
    setStep(2);
  }

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      setStep(1);
      setConfirmInput('');
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setStep(1);
      setConfirmInput('');
    }
    onOpenChange(open);
  }

  const isInputMatch = confirmInput === workspaceName;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent aria-label="Confirm ownership transfer">
        <DialogHeader>
          <DialogTitle className="text-amber-700">
            Transfer Ownership
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              {step === 1 && (
                <>
                  <p>
                    You are about to transfer ownership of{' '}
                    <strong>{workspaceName}</strong> to{' '}
                    <strong>{targetName}</strong>. You will become a Member.
                  </p>
                  {!targetIsActive && (
                    <span className="inline-block rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      Warning: This user is currently inactive
                    </span>
                  )}
                </>
              )}
              {step === 2 && (
                <p>
                  Type <strong>{workspaceName}</strong> to confirm the transfer.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        {step === 2 && (
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
            placeholder={workspaceName}
            aria-label={`Type "${workspaceName}" to confirm`}
          />
        )}
        <DialogFooter className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setConfirmInput('');
              onCancel();
            }}
            className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-primary)]"
            aria-label="Cancel transfer"
          >
            Cancel
          </button>
          {step === 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              aria-label="Continue to step 2"
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isInputMatch || isConfirming}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              aria-label="Confirm transfer ownership"
            >
              {isConfirming ? 'Transferring...' : 'Transfer Ownership'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
