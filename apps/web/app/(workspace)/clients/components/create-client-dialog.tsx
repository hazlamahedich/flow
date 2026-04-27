'use client';

import { useRef, useState } from 'react';
import { WizardOverlay } from './client-wizard/wizard-overlay';

interface CreateClientDialogProps {
  activeCount: number;
}

export function CreateClientDialog({ activeCount: _activeCount }: CreateClientDialogProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--flow-color-bg-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Add Client
      </button>
      <WizardOverlay open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} />
    </>
  );
}
