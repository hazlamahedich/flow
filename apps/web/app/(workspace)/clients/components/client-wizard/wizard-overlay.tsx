'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@flow/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@flow/ui';
import { WizardContainer } from './wizard-container';

interface WizardOverlayProps {
  open: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function WizardOverlay({ open, onClose, triggerRef }: WizardOverlayProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasData, setHasData] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const { ref: focusTrapRef } = useFocusTrap({ enabled: open, restoreFocus: false });

  const handleClose = useCallback(() => {
    if (hasData) {
      setShowConfirm(true);
      return;
    }
    onClose();
  }, [hasData, onClose]);

  const handleDiscard = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  const handleKeepEditing = useCallback(() => {
    setShowConfirm(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open || pushedRef.current) return;
    history.pushState(null, '', '');
    pushedRef.current = true;
    return () => { pushedRef.current = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePopState = () => { handleClose(); };
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const container = dialogRef.current;
        if (container) {
          const firstInput = container.querySelector<HTMLInputElement>('input');
          firstInput?.focus();
        }
      });
    } else {
      document.body.style.overflow = '';
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  const setBothRefs = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node;
    focusTrapRef(node);
  }, [focusTrapRef]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm sm:items-start sm:p-0 [&@media_(max-width:640px)]:flex-col"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div
          ref={setBothRefs}
          role="dialog"
          aria-modal="true"
          aria-label="New Client Setup Wizard"
          className="relative h-full w-full overflow-y-auto bg-[var(--flow-color-bg-primary)] p-6 sm:mx-4 sm:my-8 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:shadow-xl"
        >
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close wizard"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-primary)]"
          >
            ✕
          </button>

          <h1 className="mb-4 text-xl font-semibold text-[var(--flow-color-text-primary)]">New Client</h1>

          <WizardContainer onDataChange={setHasData} />
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved data. Discard?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={handleKeepEditing}
              className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-md bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)]"
            >
              Discard
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
